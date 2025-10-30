/**
 * Split Warehouse Script (ESM)
 * Segments the monolithic warehouse into individual JSON files per entity
 * Outputs to /public/data/ for async fetching at runtime
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the warehouse data directly from the generated file
const warehouseDataPath = path.resolve(__dirname, '../src/data/warehouse-data.ts');
const warehouseData = fs.readFileSync(warehouseDataPath, 'utf-8');

// Extract the warehouseData export using regex
const match = warehouseData.match(/export const warehouseData: Warehouse = ({[\s\S]+});/);
if (!match) {
  console.error('❌ Could not parse warehouse-data.ts');
  process.exit(1);
}

// Parse the warehouse data
const warehouse = eval(`(${match[1]})`);

const outDir = path.resolve(__dirname, '../public/data');
fs.mkdirSync(outDir, { recursive: true });

const manifest = {
  version: Date.now(),
  counts: {},
  entities: [],
};

console.log('🔨 Splitting warehouse data into segmented JSON files...\n');

for (const [key, value] of Object.entries(warehouse)) {
  manifest.entities.push(key);
  manifest.counts[key] = Array.isArray(value) ? value.length : 0;

  const filePath = path.join(outDir, `${key}.json`);
  fs.writeFileSync(filePath, JSON.stringify(value, null, 0));

  const sizeKB = (fs.statSync(filePath).size / 1024).toFixed(2);
  console.log(`  ✓ ${key.padEnd(20)} ${String(manifest.counts[key]).padStart(4)} records  ${String(sizeKB).padStart(8)} KB`);
}

// Write manifest
const manifestPath = path.join(outDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Calculate total size
const totalSizeKB = manifest.entities
  .reduce((sum, entity) => {
    const filePath = path.join(outDir, `${entity}.json`);
    return sum + fs.statSync(filePath).size;
  }, 0) / 1024;

console.log('\n✅ Segmented dataset written successfully!');
console.log(`\n📊 Summary:`);
console.log(`   Entities: ${manifest.entities.length}`);
console.log(`   Total Records: ${Object.values(manifest.counts).reduce((a, b) => a + b, 0)}`);
console.log(`   Total Size: ${totalSizeKB.toFixed(2)} KB`);
console.log(`   Manifest: manifest.json`);
console.log(`\n📁 Output directory: ${outDir}`);
