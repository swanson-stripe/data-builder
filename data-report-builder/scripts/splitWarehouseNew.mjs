#!/usr/bin/env node

/**
 * Split warehouse-data.ts into individual JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('📦 Splitting warehouse data into JSON files...\n');

// Read warehouse-data.ts
const warehouseDataPath = path.join(__dirname, '..', 'src', 'data', 'warehouse-data.ts');
const content = fs.readFileSync(warehouseDataPath, 'utf-8');

// Extract the warehouse object using regex (find the JSON part)
const match = content.match(/export const warehouse = ({[\s\S]*});/);
if (!match) {
  console.error('❌ Could not parse warehouse-data.ts');
  process.exit(1);
}

const warehouse = JSON.parse(match[1]);

// Create output directory
const outputDir = path.join(__dirname, '..', 'public', 'data');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write each table to a separate JSON file
let totalRecords = 0;
for (const [tableName, records] of Object.entries(warehouse)) {
  const outputPath = path.join(outputDir, `${tableName}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(records, null, 2), 'utf-8');
  
  const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(2);
  console.log(`  ✓ ${tableName}.json (${records.length} records, ${fileSizeKB} KB)`);
  totalRecords += records.length;
}

console.log(`\n✅ Split ${totalRecords.toLocaleString()} records into ${Object.keys(warehouse).length} files`);
console.log(`📁 Output directory: ${outputDir}\n`);

