// reportToPreset.ts
// Utility to convert taxonomy reports into working preset configurations

import { TemplateReport } from '@/data/templateTaxonomy';
import { PresetKey } from './presets';
import { Granularity } from './time';
import { MetricOp, MetricType, FilterCondition } from '@/types';

type QualifiedField = { object: string; field: string };

interface PresetConfigPartial {
  key: PresetKey;
  label: string;
  reportId: string;
  objects: string[];
  fields: QualifiedField[];
  metric: {
    name: string;
    source: QualifiedField | undefined;
    op: MetricOp;
    type: MetricType;
  };
  range: { start: string; end: string; granularity: Granularity };
  filters?: FilterCondition[];
  chartType?: 'line' | 'area' | 'bar';
}

// Helper to generate today's date in ISO format
const todayISO = () => new Date().toISOString().slice(0, 10);

// Helper to map report metric type to MetricType
function mapMetricType(reportMetricType: 'integer' | 'currency' | 'ratio' | 'float'): MetricType {
  // For now, map to sum_over_period for most types
  // This can be refined based on specific report needs
  if (reportMetricType === 'ratio') {
    return 'sum_over_period'; // Will need multi-block for actual ratios
  }
  return 'sum_over_period';
}

// Helper to map SQL aggregation expression to MetricOp
function mapMetricOp(expression: string): MetricOp {
  const upperExpr = expression.toUpperCase();
  if (upperExpr.includes('COUNT')) return 'count';
  if (upperExpr.includes('SUM')) return 'sum';
  if (upperExpr.includes('AVG')) return 'avg';
  // Note: MAX and MIN are not supported MetricOps, default to sum
  return 'sum'; // default
}

// Helper to extract field reference from SQL expression
function extractFieldFromExpression(expression: string, baseTables: TemplateReport['base_tables']): QualifiedField | undefined {
  // Look for patterns like table_alias.field_name
  const fieldMatch = expression.match(/(\w+)\.(\w+)/);
  if (!fieldMatch) return undefined;
  
  const [, alias, field] = fieldMatch;
  
  // Find the table name from the alias
  const table = baseTables.find(t => t.alias === alias);
  if (!table) return undefined;
  
  return { object: table.table, field };
}

// Helper to convert report filters to FilterCondition[]
function convertFilters(report: TemplateReport): FilterCondition[] {
  const filters: FilterCondition[] = [];
  
  // For now, only handle basic required filters
  // More complex filtering can be added later
  for (const filter of report.required_filters) {
    if (filter.type === 'daterange') {
      // Date range filters are handled by the range property
      continue;
    }
    
    // Handle other filter types as needed
    // This is a placeholder for future expansion
  }
  
  return filters;
}

/**
 * Convert a TemplateReport from taxonomy into a PresetConfig
 * This is a simplified converter that handles basic cases.
 * More complex reports may need manual preset definitions.
 */
export function convertReportToPreset(
  report: TemplateReport,
  presetKey: PresetKey
): PresetConfigPartial {
  // Extract objects from base_tables
  const objects = report.base_tables.map(t => t.table);
  
  // Get the primary metric (first one)
  const primaryMetric = report.metrics[0];
  
  // Extract fields from dimensions and metrics
  const fields: QualifiedField[] = [];
  
  // Add dimension fields
  for (const dim of report.dimensions) {
    if (dim.column && dim.table) {
      const table = report.base_tables.find(t => t.alias === dim.table);
      if (table) {
        fields.push({ object: table.table, field: dim.column });
      }
    }
  }
  
  // Try to extract the source field from the primary metric
  const metricSource = extractFieldFromExpression(primaryMetric.expression, report.base_tables);
  
  // Determine metric operation and type
  const metricOp = mapMetricOp(primaryMetric.expression);
  const metricType = mapMetricType(primaryMetric.type);
  
  // Convert filters
  const filters = convertFilters(report);
  
  // Set default date range (YTD, weekly)
  const range = {
    start: `${new Date().getFullYear()}-01-01`,
    end: todayISO(),
    granularity: 'week' as Granularity,
  };
  
  return {
    key: presetKey,
    label: report.label,
    reportId: report.id,
    objects,
    fields,
    metric: {
      name: primaryMetric.label,
      source: metricSource,
      op: metricOp,
      type: metricType,
    },
    range,
    filters: filters.length > 0 ? filters : undefined,
    chartType: 'line', // Default to line chart
  };
}

/**
 * Helper to create a minimal preset for a report
 * Use this for quick placeholders until proper conversion is implemented
 */
export function createMinimalPreset(
  report: TemplateReport,
  presetKey: PresetKey
): PresetConfigPartial {
  const objects = report.base_tables.map(t => t.table);
  const primaryMetric = report.metrics[0];
  
  return {
    key: presetKey,
    label: report.label,
    reportId: report.id,
    objects,
    fields: [],
    metric: {
      name: primaryMetric.label,
      source: undefined,
      op: 'count',
      type: 'sum_over_period',
    },
    range: {
      start: `${new Date().getFullYear()}-01-01`,
      end: todayISO(),
      granularity: 'week',
    },
    chartType: 'line',
  };
}

