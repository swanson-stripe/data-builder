import { MetricDef, MetricResult, SeriesPoint, SchemaCatalog, ValueKind, MetricOp } from '@/types';
import { Granularity, rangeByGranularity, bucketLabel } from '@/lib/time';
import { pickTimestamp } from '@/lib/fields';
import { Warehouse } from '@/data/warehouse';

/**
 * Parameters for computing a metric
 */
export type ComputeMetricParams = {
  def: MetricDef;
  start: string;
  end: string;
  granularity: Granularity;
  store: Warehouse | Partial<Record<string, any[]>>;
  include?: Set<string>; // Set of "${object}:${id}" for PK-based filtering
  schema?: SchemaCatalog;
  objects?: string[]; // Selected objects - first one is primary
};

/**
 * Infer value kind (currency, number, or string) from schema field
 */
export function inferValueKind(object: string, field: string, schema?: SchemaCatalog): ValueKind {
  if (!schema) return 'number';

  // Currency-like field names
  const currencyFields = ['amount', 'price', 'unit_amount', 'balance', 'total', 'amount_paid', 'amount_due'];
  if (currencyFields.some(cf => field.toLowerCase().includes(cf))) {
    return 'currency';
  }

  // Find the field in schema
  const schemaObj = schema.objects.find(o => o.name === object);
  if (!schemaObj) return 'number';

  const schemaField = schemaObj.fields.find(f => f.name === field);
  if (!schemaField) return 'number';

  // Type-based inference
  if (schemaField.type === 'number') return 'number';
  if (schemaField.type === 'string') return 'string';

  return 'number';
}

/**
 * Bucket rows by granularity
 */
export function bucketRows(
  rows: any[],
  object: string,
  start: string,
  end: string,
  granularity: Granularity
): Map<string, any[]> {
  const buckets = new Map<string, any[]>();
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Initialize all buckets
  const bucketDates = rangeByGranularity(startDate, endDate, granularity);
  for (const date of bucketDates) {
    const label = bucketLabel(date, granularity);
    buckets.set(label, []);
  }

  // Place rows into buckets
  for (const row of rows) {
    // pickTimestamp returns the timestamp VALUE, not the field name
    const timestamp = pickTimestamp(object, row);
    if (!timestamp) continue;

    const rowDate = new Date(timestamp);
    if (rowDate < startDate || rowDate > endDate) continue;

    const label = bucketLabel(rowDate, granularity);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(row);
    }
  }

  return buckets;
}

/**
 * Apply a metric operation to bucket data
 */
function applyOperation(
  bucketRows: any[],
  sourceField: string,
  sourceObject: string,
  op: MetricOp
): number | null {
  if (op === 'count') {
    return bucketRows.length;
  }

  // Build qualified field name (e.g., "price.unit_amount")
  const qualifiedField = `${sourceObject}.${sourceField}`;

  if (op === 'distinct_count') {
    const values = bucketRows.map(row => row[qualifiedField] ?? row[sourceField]).filter(v => v != null);
    return new Set(values).size;
  }

  // Extract numeric values - try qualified name first, then unqualified
  const values = bucketRows
    .map(row => {
      const val = row[qualifiedField] ?? row[sourceField];
      return typeof val === 'number' ? val : parseFloat(val);
    })
    .filter(v => !isNaN(v));

  if (values.length === 0) return null;

  switch (op) {
    case 'sum':
      return values.reduce((acc, val) => acc + val, 0);

    case 'avg':
      return values.reduce((acc, val) => acc + val, 0) / values.length;

    case 'median': {
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    }

    case 'mode': {
      const freq = new Map<number, number>();
      values.forEach(v => freq.set(v, (freq.get(v) || 0) + 1));
      let maxFreq = 0;
      let mode: number | null = null;
      freq.forEach((count, value) => {
        if (count > maxFreq) {
          maxFreq = count;
          mode = value;
        }
      });
      return mode;
    }

    default:
      return null;
  }
}

/**
 * Compute a metric based on the metric definition and data from warehouse
 */
export function computeMetric({
  def,
  start,
  end,
  granularity,
  store,
  include,
  schema,
  objects,
}: ComputeMetricParams): MetricResult {
  // Check if source is defined
  if (!def.source) {
    return {
      value: null,
      series: null,
      note: 'Select a metric source field',
    };
  }

  const { object: sourceObject, field } = def.source;
  const kind = inferValueKind(sourceObject, field, schema);

  // Determine primary object:
  // 1. If we have selected objects, use the first one (it's the primary table)
  // 2. Otherwise, try to infer from include set
  // 3. Fall back to source object
  let primaryObject = sourceObject;
  
  if (objects && objects.length > 0) {
    primaryObject = objects[0];
  } else if (include && include.size > 0) {
    const firstKey = Array.from(include)[0];
    primaryObject = firstKey.split(':')[0];
  }

  // Get primary rows from warehouse
  // @ts-ignore - dynamic property access on Warehouse
  let allRows = store[primaryObject];
  if (!allRows) {
    const pluralKey = primaryObject + 's' as keyof Warehouse;
    allRows = store[pluralKey];
  }

  if (!allRows || !Array.isArray(allRows)) {
    return {
      value: null,
      series: null,
      note: `No data found for ${primaryObject}`,
    };
  }

  // Filter rows by PK allowlist (if provided)
  let rows = allRows;
  if (include && include.size > 0) {
    rows = allRows.filter(row => {
      const rowKey = `${primaryObject}:${row.id}`;
      return include.has(rowKey);
    });
  }

  // If source object is different from primary, perform join
  if (sourceObject !== primaryObject) {
    // Build lookup maps for ALL loaded entities in warehouse (not just selected objects)
    // This enables smart multi-hop joins even when intermediate tables aren't explicitly selected
    const allLoadedEntities = Object.keys(store);
    const relatedMaps = new Map<string, Map<string, any>>();
    const bridgeMaps = new Map<string, Map<string, any[]>>();
    
    console.log(`[Metrics] Computing metric with join: ${primaryObject} -> ${sourceObject}.${field}`);
    console.log(`[Metrics] Available entities in store:`, allLoadedEntities);
    
    for (const entityName of allLoadedEntities) {
      // @ts-ignore
      const entityTable = store[entityName];
      
      if (entityTable && Array.isArray(entityTable) && entityTable.length > 0) {
        // Build direct lookup map
        relatedMaps.set(entityName, new Map(entityTable.map((r: any) => [r.id, r])));
        
        // Build reverse indexes for foreign keys (bridge maps)
        const sampleRecord = entityTable[0];
        for (const key of Object.keys(sampleRecord)) {
          if (key.endsWith('_id') && key !== 'id') {
            const foreignObject = key.replace(/_id$/, '');
            const bridgeKey = `${entityName}_by_${foreignObject}`;
            const reverseMap = new Map<string, any[]>();
            
            for (const r of entityTable) {
              const fkValue = r[key];
              if (fkValue) {
                if (!reverseMap.has(fkValue)) {
                  reverseMap.set(fkValue, []);
                }
                reverseMap.get(fkValue)!.push(r);
              }
            }
            
            bridgeMaps.set(bridgeKey, reverseMap);
          }
        }
      }
    }
    
    // Join: add qualified field to each row using multi-hop join logic
    const qualifiedField = `${sourceObject}.${field}`;
    rows = rows.map(row => {
      let joinedValue = null;
      
      // Strategy 1: Try 1-hop direct FK
      const foreignKey = `${sourceObject}_id`;
      const relatedId = row[foreignKey];
      const relatedMap = relatedMaps.get(sourceObject);
      
      if (relatedId && relatedMap) {
        const relatedRow = relatedMap.get(relatedId);
        if (relatedRow) {
          joinedValue = relatedRow[field];
        }
      }
      
      // Strategy 2: Try reverse lookup (target object has primary_object_id)
      if (joinedValue === null) {
        const bridgeKey = `${sourceObject}_by_${primaryObject}`;
        const bridgeRecords = bridgeMaps.get(bridgeKey);
        if (bridgeRecords) {
          const records = bridgeRecords.get(row.id);
          if (records && records.length > 0) {
            joinedValue = records[0][field];
          }
        }
      }
      
      // Strategy 3: Try 2-hop join through intermediate bridge table across ALL loaded entities
      // e.g., subscription -> subscription_item (bridge) -> price
      if (joinedValue === null) {
        for (const intermediateObj of allLoadedEntities) {
          if (intermediateObj === sourceObject || intermediateObj === primaryObject) continue;
          
          const primaryToBridge = `${intermediateObj}_by_${primaryObject}`;
          const bridgeToTarget = relatedMaps.get(sourceObject);
          
          const primaryBridgeRecords = bridgeMaps.get(primaryToBridge);
          if (primaryBridgeRecords && bridgeToTarget) {
            const bridgeRecords = primaryBridgeRecords.get(row.id);
            if (bridgeRecords && bridgeRecords.length > 0) {
              const targetFk = `${sourceObject}_id`;
              for (const bridgeRecord of bridgeRecords) {
                if (bridgeRecord[targetFk]) {
                  const targetRecord = bridgeToTarget.get(bridgeRecord[targetFk]);
                  if (targetRecord) {
                    joinedValue = targetRecord[field];
                    console.log(`[Metrics] Multi-hop join success: ${primaryObject} -> ${intermediateObj} -> ${sourceObject}.${field}`);
                    break;
                  }
                }
              }
              if (joinedValue !== null) break;
            }
          }
          
          // Strategy 4: Forward traversal (primary.intermediate_id -> intermediate -> target)
          // e.g., subscription.subscription_item_id -> subscription_item -> subscription_item.price_id -> price
          if (joinedValue === null) {
            const intermediateFk = `${intermediateObj}_id`;
            const intermediateId = row[intermediateFk];
            const intermediateMap = relatedMaps.get(intermediateObj);
            
            if (intermediateId && intermediateMap) {
              const intermediateRecord = intermediateMap.get(intermediateId);
              if (intermediateRecord) {
                const targetFk = `${sourceObject}_id`;
                const targetId = intermediateRecord[targetFk];
                const targetMap = relatedMaps.get(sourceObject);
                
                if (targetId && targetMap) {
                  const targetRecord = targetMap.get(targetId);
                  if (targetRecord) {
                    joinedValue = targetRecord[field];
                    console.log(`[Metrics] Multi-hop join success: ${primaryObject} -> ${intermediateObj} -> ${sourceObject}.${field}`);
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // Strategy 5: 3-hop join through TWO intermediate tables
      // e.g., customer -> subscription -> subscription_item -> price
      if (joinedValue === null) {
        for (const intermediateObj of allLoadedEntities) {
          if (intermediateObj === sourceObject || intermediateObj === primaryObject) continue;
          
          // Get all records of intermediate type that link to primary
          const primaryToBridge1 = `${intermediateObj}_by_${primaryObject}`;
          const bridge1Records = bridgeMaps.get(primaryToBridge1);
          
          if (bridge1Records) {
            const intermediateRecords = bridge1Records.get(row.id);
            if (intermediateRecords && intermediateRecords.length > 0) {
              // For each intermediate record, try to find a path to target through another bridge
              for (const intermediateRecord of intermediateRecords) {
                // Try all possible second-level bridges
                for (const secondIntermediate of allLoadedEntities) {
                  if (secondIntermediate === sourceObject || secondIntermediate === primaryObject || secondIntermediate === intermediateObj) continue;
                  
                  const bridge2Key = `${secondIntermediate}_by_${intermediateObj}`;
                  const bridge2Records = bridgeMaps.get(bridge2Key);
                  
                  if (bridge2Records) {
                    const secondLevelRecords = bridge2Records.get(intermediateRecord.id);
                    if (secondLevelRecords && secondLevelRecords.length > 0) {
                      // Check if second-level bridge has FK to target
                      const targetFk = `${sourceObject}_id`;
                      for (const secondLevelRecord of secondLevelRecords) {
                        if (secondLevelRecord[targetFk]) {
                          const targetMap = relatedMaps.get(sourceObject);
                          if (targetMap) {
                            const targetRecord = targetMap.get(secondLevelRecord[targetFk]);
                            if (targetRecord) {
                              joinedValue = targetRecord[field];
                              console.log(`[Metrics] 3-hop join success: ${primaryObject} -> ${intermediateObj} -> ${secondIntermediate} -> ${sourceObject}.${field}`);
                              break;
                            }
                          }
                        }
                      }
                      if (joinedValue !== null) break;
                    }
                  }
                }
                if (joinedValue !== null) break;
              }
              if (joinedValue !== null) break;
            }
          }
        }
      }
      
      return {
        ...row,
        [qualifiedField]: joinedValue,
      };
    });
  }

  // If no rows after filtering, return zero/null
  if (rows.length === 0) {
    return {
      value: null,
      series: null,
      note: 'No data in selection',
    };
  }

  // Bucket the rows by timestamp using pickTimestamp
  const buckets = bucketRows(rows, primaryObject, start, end, granularity);
  const bucketEntries = Array.from(buckets.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // Compute per-bucket values
  const perBucketValues: Array<{ date: string; value: number }> = [];

  for (const [bucketDate, bucketRows] of bucketEntries) {
    const bucketValue = applyOperation(bucketRows, field, sourceObject, def.op);
    if (bucketValue !== null) {
      perBucketValues.push({ date: bucketDate, value: bucketValue });
    } else {
      perBucketValues.push({ date: bucketDate, value: 0 });
    }
  }

  // Apply metric type for headline and series
  let headlineValue: number | null = null;
  const series: SeriesPoint[] = perBucketValues;

  const nonNullValues = perBucketValues.map(p => p.value).filter(v => v !== 0);

  switch (def.type) {
    case 'sum_over_period':
      headlineValue = perBucketValues.reduce((acc, p) => acc + p.value, 0);
      break;

    case 'average_over_period':
      headlineValue = nonNullValues.length > 0
        ? nonNullValues.reduce((acc, v) => acc + v, 0) / nonNullValues.length
        : null;
      break;

    case 'latest':
      headlineValue = perBucketValues.length > 0
        ? perBucketValues[perBucketValues.length - 1].value
        : null;
      break;

    case 'first':
      headlineValue = perBucketValues.length > 0
        ? perBucketValues[0].value
        : null;
      break;
  }

  return {
    value: headlineValue,
    series,
    kind,
  };
}
