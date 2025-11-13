/**
 * Export warehouse-data to JSON files for browser loading
 * This reads from warehouse-fresh.ts and exports to public/data/*.json
 */

import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Dynamic import of the warehouse data
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('📦 Exporting warehouse data to JSON files...\n');

// Import the compiled warehouse data
let warehouseData;
try {
  // Use dynamic import to load the TypeScript/ESM module
  const module = await import('../src/data/warehouse-fresh.ts');
  warehouseData = module.warehouseData;
} catch (error) {
  console.error('❌ Failed to import warehouse data:', error.message);
  console.error('Make sure the project is built or TypeScript can be loaded');
  process.exit(1);
}

if (!warehouseData) {
  console.error('❌ warehouseData is undefined');
  process.exit(1);
}

// Create public/data directory
const publicDataDir = join(projectRoot, 'public/data');
mkdirSync(publicDataDir, { recursive: true });

// Export each entity as JSON
const entities = Object.keys(warehouseData);
console.log(`Found ${entities.length} entities to export\n`);

entities.forEach(entityName => {
  const data = warehouseData[entityName];
  if (!Array.isArray(data)) {
    console.log(`⚠️  Skipping ${entityName} (not an array)`);
    return;
  }
  
  const filename = `${entityName}.json`;
  const filepath = join(publicDataDir, filename);
  
  writeFileSync(filepath, JSON.stringify(data, null, 0)); // No formatting to save space
  const sizeKB = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(1);
  console.log(`✅ ${entityName.padEnd(20)} ${data.length.toString().padStart(6)} records  ${sizeKB.padStart(8)} KB`);
});

// Create manifest
const manifest = {
  generated: new Date().toISOString(),
  entities: entities,
  counts: entities.reduce((acc, name) => {
    if (Array.isArray(warehouseData[name])) {
      acc[name] = warehouseData[name].length;
    }
    return acc;
  }, {})
};

writeFileSync(
  join(publicDataDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('\n✅ Export complete!');
console.log(`📂 Location: ${publicDataDir}`);
console.log('\n🔄 Restart dev server to load new data');
