/**
 * Transform 3-level taxonomy into 4-level hierarchy
 * 
 * Input: Category → Topic → Report (with dimensions)
 * Output: Category → Topic → SubTopic → Report
 * 
 * Strategy: Each input "report" becomes a "subTopic", and each dimension becomes a separate report
 */

const fs = require('fs');
const path = require('path');

// This would be imported from the JSON, but for now inline the structure
const taxonomy = require('../src/data/templateTaxonomy-input.json');

function transformTaxonomy(input) {
  return input.top_categories.map(category => ({
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
          .filter(dim => dim.id !== 'none') // Skip "no breakdown" dimension
          .map(dimension => ({
            id: `${report.id}_${dimension.id}`,
            label: dimension.label.startsWith('By ') 
              ? `${report.label} ${dimension.label.toLowerCase()}`
              : dimension.label,
            description: `${report.description} Broken down ${dimension.label.toLowerCase()}.`,
            base_tables: report.base_tables,
            time_column: report.time_column,
            metrics: report.metrics,
            dimensions: [dimension], // Single dimension for this report
            default_dimension: dimension.id,
            required_filters: report.required_filters,
            optional_filters: report.optional_filters,
            default_order_by: report.default_order_by || []
          }))
      }))
    }))
  }));
}

// Read input, transform, write output
const inputPath = path.join(__dirname, '../src/data/templateTaxonomy-input.json');
const outputPath = path.join(__dirname, '../src/data/templateTaxonomy-output.ts');

const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const output = transformTaxonomy(input);

// Generate TypeScript file
const tsContent = `// Template taxonomy for waterfall category filtering
// Defines the hierarchical structure: Category → Topic → SubTopic → Report
// AUTO-GENERATED - DO NOT EDIT MANUALLY

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

export const TEMPLATE_TAXONOMY: TemplateCategory[] = ${JSON.stringify(output, null, 2)};
`;

fs.writeFileSync(outputPath, tsContent, 'utf8');
console.log('✅ Transformed taxonomy written to:', outputPath);
console.log(`   Total categories: ${output.length}`);
console.log(`   Total topics: ${output.reduce((sum, cat) => sum + cat.topics.length, 0)}`);
console.log(`   Total sub-topics: ${output.reduce((sum, cat) => sum + cat.topics.reduce((s, t) => s + t.subTopics.length, 0), 0)}`);
console.log(`   Total reports: ${output.reduce((sum, cat) => sum + cat.topics.reduce((s, t) => s + t.subTopics.reduce((ss, st) => ss + st.reports.length, 0), 0), 0)}`);

