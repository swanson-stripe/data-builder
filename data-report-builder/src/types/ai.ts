// src/types/ai.ts
import { FilterCondition } from '@/types';
import { Granularity } from '@/lib/time';
import { ChartType } from '@/state/app';

export type AIParseResult = {
  success: true;
  config: AIReportConfig;
  confidence: number; // 0-1 score
  explanation?: string; // Optional explanation of what was parsed
} | {
  success: false;
  error: string;
  needsClarification?: boolean;
  followUpQuestions?: string[];
};

export type AIReportConfig = {
  // Objects to auto-select in the Data tab
  objects: string[];
  // Qualified fields to auto-select in the Data List
  fields: { object: string; field: string }[];
  // Metric driving the value/chart/summary (for simple metrics)
  metric?: {
    name: string;
    source: { object: string; field: string } | undefined;
    op: 'sum' | 'count' | 'avg' | 'min' | 'max';
    type: 'sum_over_period' | 'latest' | 'first' | 'last';
  };
  // Multi-block metric (for rate/percentage metrics)
  multiBlock?: {
    blocks: Array<{
      id: string;
      name: string;
      source: { object: string; field: string };
      op: 'sum' | 'count' | 'avg' | 'min' | 'max';
      type: 'sum_over_period' | 'latest' | 'first' | 'last';
      filters: FilterCondition[];
    }>;
    calculation: {
      operator: 'divide' | 'multiply' | 'add' | 'subtract';
      leftOperand: string;
      rightOperand: string;
      resultUnitType: 'rate' | 'currency' | 'count';
    };
    outputUnit: string;
  };
  // Optional default time settings
  range?: {
    start: string;
    end: string;
    granularity: Granularity;
  };
  // Optional filters to apply
  filters?: FilterCondition[];
  // Optional chart settings
  chartType?: ChartType;
};

