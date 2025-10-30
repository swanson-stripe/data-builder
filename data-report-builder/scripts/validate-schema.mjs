#!/usr/bin/env node

/**
 * Comprehensive validation suite for generated Stripe schema data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Stripe Schema Validation Suite                               ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Load warehouse data
const warehouseDataPath = path.join(__dirname, '..', 'src', 'data', 'warehouse-data.ts');
const content = fs.readFileSync(warehouseDataPath, 'utf-8');
const match = content.match(/export const warehouse = ({[\s\S]*});/);

if (!match) {
  console.error('❌ Could not parse warehouse-data.ts');
  process.exit(1);
}

const warehouse = JSON.parse(match[1]);

let totalErrors = 0;
const warnings = [];

// ============================================================================
// Test 1: Foreign Key Integrity
// ============================================================================
console.log('📝 Test 1: Foreign Key Integrity\n');

const relationships = [
  { from: 'subscription', to: 'customer', via: 'customer_id' },
  { from: 'subscription_item', to: 'subscription', via: 'subscription_id' },
  { from: 'invoice', to: 'customer', via: 'customer_id' },
  { from: 'invoice', to: 'subscription', via: 'subscription_id' },
  { from: 'invoice_item', to: 'invoice', via: 'invoice_id' },
  { from: 'payment_method', to: 'customer', via: 'customer_id' },
  { from: 'payment_intent', to: 'customer', via: 'customer_id' },
  { from: 'payment_intent', to: 'invoice', via: 'invoice_id' },
  { from: 'charge', to: 'payment_intent', via: 'payment_intent_id' },
  { from: 'refund', to: 'charge', via: 'charge_id' },
  { from: 'discount', to: 'coupon', via: 'coupon_id' },
  { from: 'discount', to: 'customer', via: 'customer_id' },
  { from: 'quote', to: 'customer', via: 'customer_id' },
  { from: 'credit_note', to: 'customer', via: 'customer_id' },
  { from: 'credit_note', to: 'invoice', via: 'invoice_id' },
  { from: 'dispute', to: 'charge', via: 'charge_id' },
  { from: 'customer_tax_id', to: 'customer', via: 'customer_id' },
  { from: 'subscription_schedule', to: 'customer', via: 'customer_id' },
  { from: 'subscription_schedule', to: 'subscription', via: 'subscription_id' },
];

for (const rel of relationships) {
  const fromTable = warehouse[rel.from] || [];
  const toTable = warehouse[rel.to] || [];
  
  if (fromTable.length === 0) {
    warnings.push(`Empty table: ${rel.from}`);
    continue;
  }
  
  if (toTable.length === 0) {
    warnings.push(`Empty table: ${rel.to}`);
    continue;
  }
  
  const toIds = new Set(toTable.map(r => r.id));
  let invalidCount = 0;
  
  for (const record of fromTable) {
    const fkValue = record[rel.via];
    if (fkValue && !toIds.has(fkValue)) {
      invalidCount++;
    }
  }
  
  if (invalidCount > 0) {
    console.log(`  ❌ ${rel.from} -> ${rel.to} (${rel.via}): ${invalidCount} invalid references`);
    totalErrors += invalidCount;
  } else {
    console.log(`  ✓ ${rel.from} -> ${rel.to} (${rel.via}): All ${fromTable.length} references valid`);
  }
}

console.log('');

// ============================================================================
// Test 2: Data Types & Required Fields
// ============================================================================
console.log('📝 Test 2: Data Types & Required Fields\n');

const requiredFields = {
  customer: ['id', 'email', 'created'],
  subscription: ['id', 'customer_id', 'status', 'created'],
  invoice: ['id', 'customer_id', 'created', 'status'],
  payment_method: ['id', 'customer_id', 'type', 'created'],
  charge: ['id', 'customer_id', 'amount', 'currency', 'created'],
};

for (const [tableName, fields] of Object.entries(requiredFields)) {
  const table = warehouse[tableName] || [];
  if (table.length === 0) continue;
  
  let missingCount = 0;
  for (const record of table) {
    for (const field of fields) {
      if (record[field] === null || record[field] === undefined) {
        missingCount++;
      }
    }
  }
  
  if (missingCount > 0) {
    console.log(`  ❌ ${tableName}: ${missingCount} missing required fields`);
    totalErrors += missingCount;
  } else {
    console.log(`  ✓ ${tableName}: All required fields present`);
  }
}

console.log('');

// ============================================================================
// Test 3: Date Sequence Logic
// ============================================================================
console.log('📝 Test 3: Date Sequence Logic\n');

const dateSequences = [
  { table: 'subscription', before: 'created', after: 'current_period_start' },
  { table: 'subscription', before: 'current_period_start', after: 'current_period_end' },
  { table: 'invoice', before: 'created', after: 'due_date' },
];

for (const seq of dateSequences) {
  const table = warehouse[seq.table] || [];
  if (table.length === 0) continue;
  
  let invalidCount = 0;
  for (const record of table) {
    const before = record[seq.before];
    const after = record[seq.after];
    
    if (before && after && new Date(before) > new Date(after)) {
      invalidCount++;
    }
  }
  
  if (invalidCount > 0) {
    console.log(`  ❌ ${seq.table}: ${invalidCount} invalid date sequences (${seq.before} > ${seq.after})`);
    totalErrors += invalidCount;
  } else {
    console.log(`  ✓ ${seq.table}: All date sequences valid (${seq.before} < ${seq.after})`);
  }
}

console.log('');

// ============================================================================
// Test 4: Amount Consistency
// ============================================================================
console.log('📝 Test 4: Amount Consistency\n');

const charges = warehouse.charge || [];
let chargeErrors = 0;

for (const charge of charges) {
  if (charge.amount_refunded > charge.amount) {
    chargeErrors++;
  }
  if (charge.amount_captured > charge.amount) {
    chargeErrors++;
  }
}

if (chargeErrors > 0) {
  console.log(`  ❌ Charges: ${chargeErrors} amount inconsistencies`);
  totalErrors += chargeErrors;
} else {
  console.log(`  ✓ Charges: All amounts consistent (${charges.length} charges)`);
}

const invoices = warehouse.invoice || [];
let invoiceErrors = 0;

for (const invoice of invoices) {
  if (invoice.amount_paid + invoice.amount_remaining !== invoice.amount_due) {
    invoiceErrors++;
  }
}

if (invoiceErrors > 0) {
  console.log(`  ❌ Invoices: ${invoiceErrors} amount inconsistencies`);
  totalErrors += invoiceErrors;
} else {
  console.log(`  ✓ Invoices: All amounts consistent (${invoices.length} invoices)`);
}

console.log('');

// ============================================================================
// Summary
// ============================================================================
console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Validation Summary                                            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

const totalRecords = Object.values(warehouse).reduce((sum, arr) => sum + arr.length, 0);

console.log(`📊 Dataset Statistics:`);
console.log(`  • Total records: ${totalRecords.toLocaleString()}`);
console.log(`  • Tables: ${Object.keys(warehouse).length}`);
console.log(`  • Non-empty tables: ${Object.values(warehouse).filter(arr => arr.length > 0).length}\n`);

if (warnings.length > 0) {
  console.log(`⚠️  Warnings: ${warnings.length}`);
  for (const warning of warnings.slice(0, 5)) {
    console.log(`  • ${warning}`);
  }
  if (warnings.length > 5) {
    console.log(`  ... and ${warnings.length - 5} more`);
  }
  console.log('');
}

if (totalErrors > 0) {
  console.log(`❌ Validation FAILED: ${totalErrors.toLocaleString()} errors found\n`);
  process.exit(1);
} else {
  console.log(`✅ Validation PASSED: No errors found\n`);
  process.exit(0);
}

