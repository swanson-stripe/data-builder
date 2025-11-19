#!/usr/bin/env node
/**
 * Transform 3-level taxonomy into 4-level hierarchy
 * Reads from templateTaxonomy.old.ts, outputs to templateTaxonomy.ts
 */

const fs = require('fs');
const path = require('path');

// Read old taxonomy file
const oldPath = path.join(__dirname, '../src/data/templateTaxonomy.old.ts');
const oldContent = fs.readFileSync(oldPath, 'utf8');

// Extract TEMPLATE_TAXONOMY array
const match = oldContent.match(/export const TEMPLATE_TAXONOMY[^=]*=\s*(\[[\s\S]*\]);/);
if (!match) {
  console.error('❌ Could not find TEMPLATE_TAXONOMY in old file');
  process.exit(1);
}

// Parse JSON (with cleanup)
const jsonStr = match[1]
  .replace(/\/\/[^\n]*/g, '') // Remove inline comments
  .replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas

let oldTaxonomy;
try {
  oldTaxonomy = eval('(' + jsonStr + ')');
} catch (e) {
  console.error('❌ Failed to parse old taxonomy:', e.message);
  process.exit(1);
}

console.log('📖 Parsed old taxonomy:', oldTaxonomy.length, 'categories');

// Transform each report's dimensions into separate reports
function transformToFourLevel(categories) {
  return categories.map(category => ({
    id: category.id,
    label: category.label,
    description: category.description,
    topics: category.topics.map(topic => ({
      id: topic.id,
      label: topic.label,
      description: topic.description,
      subTopics: topic.reports.map(report => ({
        id: report.id,
        label: report.label,
        description: report.description,
        reports: report.dimensions
          .filter(dim => dim.id !== 'none') // Skip "no breakdown"
          .map(dimension => ({
            id: `${report.id}_${dimension.id}`,
            label: dimension.label.startsWith('By ') 
              ? `${report.label} ${dimension.label.toLowerCase()}`
              : dimension.label,
            description: `${report.description} Grouped ${dimension.label.toLowerCase()}.`,
            base_tables: report.base_tables,
            time_column: report.time_column,
            metrics: report.metrics,
            dimensions: [dimension],
            default_dimension: dimension.id,
            required_filters: report.required_filters,
            optional_filters: report.optional_filters,
            default_order_by: report.default_order_by || []
          }))
      }))
    }))
  }));
}

const newTaxonomy = transformToFourLevel(oldTaxonomy);

// Count stats
const stats = {
  categories: newTaxonomy.length,
  topics: newTaxonomy.reduce((s, c) => s + c.topics.length, 0),
  subTopics: newTaxonomy.reduce((s, c) => s + c.topics.reduce((ss, t) => ss + t.subTopics.length, 0), 0),
  reports: newTaxonomy.reduce((s, c) => s + c.topics.reduce((ss, t) => ss + t.subTopics.reduce((sss, st) => sss + st.reports.length, 0), 0), 0)
};

console.log('✅ Transformed to 4-level hierarchy');
console.log(`   Categories: ${stats.categories}`);
console.log(`   Topics: ${stats.topics}`);
console.log(`   SubTopics: ${stats.subTopics}`);
console.log(`   Reports: ${stats.reports}`);

// Generate TypeScript file
const typeDefinitions = `// Template taxonomy for waterfall category filtering
// Defines the hierarchical structure: Category → Topic → SubTopic → Report

export interface BaseTable {
  alias: string;
  table: string;
  join_on?: string;
  join_type?: 'left' | 'right' | 'inner';
}

export interface ReportMetric {
  id: string;
  label: string;
  expression: string;
  type: 'integer' | 'currency' | 'ratio' | 'float';
  note?: string;
}

export interface ReportDimension {
  id: string;
  label: string;
  column: string | null;
  table: string | null;
  expression?: string;
}

export interface ReportFilter {
  id: string;
  label: string;
  type: 'daterange' | 'enum' | 'string' | 'country' | 'number' | 'date' | 'boolean';
  column: string;
  operator: 'between' | 'in' | '=' | '>=' | '<=' | '>' | '<';
  param?: string;
  param_from?: string;
  param_to?: string;
  default_value?: string;
}

export interface ReportOrderBy {
  expression: string;
  direction: 'asc' | 'desc';
}

export interface TemplateReport {
  id: string;
  label: string;
  description: string;
  base_tables: BaseTable[];
  time_column: string;
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  default_dimension: string | null;
  required_filters: ReportFilter[];
  optional_filters: ReportFilter[];
  default_order_by?: ReportOrderBy[];
}

export interface TemplateSubTopic {
  id: string;
  label: string;
  description: string;
  reports: TemplateReport[];
}

export interface TemplateTopic {
  id: string;
  label: string;
  description: string;
  subTopics: TemplateSubTopic[];
}

export interface TemplateCategory {
  id: string;
  label: string;
  description: string;
  topics: TemplateTopic[];
}

export const TEMPLATE_TAXONOMY: TemplateCategory[] = `;

const outputPath = path.join(__dirname, '../src/data/templateTaxonomy.ts');
const output = typeDefinitions + JSON.stringify(newTaxonomy, null, 2) + ';\n';

fs.writeFileSync(outputPath, output, 'utf8');

console.log(`📝 Written to: ${outputPath}`);
console.log(`   File size: ${Math.round(output.length / 1024)}KB`);

