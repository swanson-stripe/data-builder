// reportToPreset.ts
// Converts taxonomy TemplateReport objects to PresetConfig format

import { TemplateReport } from '@/data/templateTaxonomy';
import { FilterCondition } from '@/types';

// This type matches the PresetConfig structure from presets.ts
type QualifiedField = { object: string; field: string };

export type ConvertedPresetConfig = {
  key: string; // Report ID as synthetic key
  label: string;
  reportId?: string;
  objects: string[];
  fields: QualifiedField[];
  metric: {
    name: string;
    source: QualifiedField | undefined;
    op: 'count' | 'sum' | 'avg';
    type: 'sum_over_period' | 'latest' | 'average_over_period';
  };
  multiBlock?: {
    blocks: Array<{
      id: string;
      name: string;
      source: QualifiedField;
      op: 'count' | 'sum' | 'avg';
      type: 'sum_over_period' | 'latest' | 'average_over_period';
      filters: FilterCondition[];
    }>;
    calculation: {
      operator: 'divide' | 'multiply' | 'add' | 'subtract';
      leftOperand: string;
      rightOperand: string;
      resultUnitType?: 'percentage' | 'currency' | 'number';
    };
    outputUnit: 'rate' | 'volume' | 'count';
  };
  range?: {
    start: string;
    end: string;
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  filters?: FilterCondition[];
  chartType?: 'line' | 'bar';
  defaultSort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
  groupBy?: {
    field: QualifiedField;
    selectedValues: any[];
  };
};

// Helper to generate ISO date for "today"
const todayISO = () => new Date().toISOString().slice(0, 10);

// Helper to convert "YTD" to actual year start date
const convertDateValue = (dateStr: string): string => {
  if (dateStr === 'YTD') {
    return `${new Date().getFullYear()}-01-01`;
  }
  if (dateStr === 'today') {
    return todayISO();
  }
  return dateStr;
};

/**
 * Converts a TemplateReport from the taxonomy to a PresetConfig format
 * that can be applied to the app state via applyPreset()
 */
export function convertReportToPreset(report: TemplateReport): ConvertedPresetConfig {
  // Transform fields array: drop 'required' property
  const fields: QualifiedField[] = report.fields.map(({ object, field }) => ({
    object,
    field,
  }));

  // Build the base preset config
  const preset: ConvertedPresetConfig = {
    key: report.id, // Use report ID as the synthetic preset key
    label: report.label,
    reportId: report.id,
    objects: report.objects,
    fields,
    metric: {
      name: report.metric.name,
      source: report.metric.source,
      op: report.metric.op,
      type: report.metric.type,
    },
  };

  // Add multiBlock if present
  if (report.multiBlock) {
    preset.multiBlock = {
      blocks: report.multiBlock.blocks.map(block => ({
        id: block.id,
        name: block.name,
        source: block.source,
        op: block.op,
        type: block.type,
        filters: block.filters as FilterCondition[],
      })),
      calculation: {
        operator: report.multiBlock.calculation.operator,
        leftOperand: report.multiBlock.calculation.leftOperand,
        rightOperand: report.multiBlock.calculation.rightOperand,
        resultUnitType: report.multiBlock.calculation.resultUnitType,
      },
      outputUnit: report.multiBlock.outputUnit === 'currency' ? 'volume' : report.multiBlock.outputUnit,
    };
  }

  // Add optional fields if present
  // Convert "YTD" and "today" to actual dates
  if (report.range) {
    preset.range = {
      start: convertDateValue(report.range.start),
      end: convertDateValue(report.range.end),
      granularity: report.range.granularity,
    };
  }

  if (report.filters) {
    preset.filters = report.filters as FilterCondition[];
  }

  if (report.chartType) {
    preset.chartType = report.chartType;
  }

  if (report.defaultSort) {
    preset.defaultSort = report.defaultSort;
  }

  if (report.groupBy) {
    preset.groupBy = report.groupBy;
  }

  return preset;
}
