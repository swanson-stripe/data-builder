#!/usr/bin/env node
/**
 * Generate 4-level taxonomy from JSON config
 * 
 * Transforms: Category → Topic → Report (with dimensions)
 * Into: Category → Topic → SubTopic → Report (one per dimension)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Your complete JSON config (paste the entire JSON here)
const input = JSON.parse(`{
  "version": "1.0",
  "note": "Stripe Sigma exploration tree",
  "top_categories": ${fs.readFileSync(path.join(__dirname, 'taxonomy-input.json'), 'utf8').replace(/^[\s\S]*?"top_categories":\s*/, '')}
}`);

function transformReport(sourceReport, dimension) {
  return {
    id: `${sourceReport.id}_${dimension.id}`,
    label: dimension.label.startsWith('By ') 
      ? `${sourceReport.label} ${dimension.label.toLowerCase()}`
      : dimension.label,
    description: `${sourceReport.description} Grouped ${dimension.label.toLowerCase()}.`,
    base_tables: sourceReport.base_tables,
    time_column: sourceReport.time_column,
    metrics: sourceReport.metrics,
    dimensions: [dimension],
    default_dimension: dimension.id,
    required_filters: sourceReport.required_filters,
    optional_filters: sourceReport.optional_filters,
    default_order_by: sourceReport.default_order_by || []
  };
}

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
          .filter(dim => dim.id !== 'none') // Skip "no breakdown"
          .map(dimension => transformReport(report, dimension))
      }))
    }))
  }));
}

const transformed = transformTaxonomy(input);

// Generate TypeScript file
const types = `// Template taxonomy for waterfall category filtering
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
const output = types + JSON.stringify(transformed, null, 2) + ';\n';

fs.writeFileSync(outputPath, output, 'utf8');

console.log('✅ Generated 4-level taxonomy');
console.log(`   File: ${outputPath}`);
console.log(`   Size: ${Math.round(output.length / 1024)}KB`);
console.log(`   Categories: ${transformed.length}`);
console.log(`   Topics: ${transformed.reduce((sum, cat) => sum + cat.topics.length, 0)}`);
console.log(`   SubTopics: ${transformed.reduce((sum, cat) => sum + cat.topics.reduce((s, t) => s + t.subTopics.length, 0), 0)}`);
console.log(`   Reports: ${transformed.reduce((sum, cat) => sum + cat.topics.reduce((s, t) => s + t.subTopics.reduce((ss, st) => ss + st.reports.length, 0), 0), 0)}`);

