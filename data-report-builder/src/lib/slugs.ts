// src/lib/slugs.ts
// Utilities for converting between report labels and URL slugs

import { TEMPLATE_TAXONOMY, TemplateReport } from '@/data/templateTaxonomy';
import { PRESET_CONFIGS, PresetKey } from '@/lib/presets';

export type ReportSlug = string;

/**
 * Convert a label to a URL-safe slug
 * "Active Subscribers" → "active-subscribers"
 * "MRR" → "mrr"
 */
export function toSlug(label: string): ReportSlug {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Report info returned by slug lookup
 */
export type ReportInfo = {
  type: 'preset' | 'template';
  key: PresetKey | string; // PresetKey for presets, report.id for templates
  label: string;
  slug: ReportSlug;
  report?: TemplateReport; // Full report config for templates
};

// Build lookup maps on module load
const slugToReportMap = new Map<ReportSlug, ReportInfo>();
const keyToSlugMap = new Map<string, ReportSlug>();

// Add presets first (they take priority for common names like "MRR")
for (const [key, config] of Object.entries(PRESET_CONFIGS)) {
  if (key === 'blank') continue; // Skip blank preset
  
  const slug = toSlug(config.label);
  const info: ReportInfo = {
    type: 'preset',
    key: key as PresetKey,
    label: config.label,
    slug,
  };
  
  slugToReportMap.set(slug, info);
  keyToSlugMap.set(key, slug);
}

// Add template reports (won't overwrite presets with same slug)
for (const category of TEMPLATE_TAXONOMY) {
  for (const topic of category.topics) {
    for (const report of topic.reports) {
      const slug = toSlug(report.label);
      
      // Only add if not already taken by a preset
      if (!slugToReportMap.has(slug)) {
        const info: ReportInfo = {
          type: 'template',
          key: report.id,
          label: report.label,
          slug,
          report,
        };
        
        slugToReportMap.set(slug, info);
      }
      
      // Always map the report ID to its slug
      keyToSlugMap.set(report.id, slug);
    }
  }
}

/**
 * Look up a report by its URL slug
 * Returns undefined if not found
 */
export function fromSlug(slug: ReportSlug): ReportInfo | undefined {
  return slugToReportMap.get(slug);
}

/**
 * Get the slug for a report key (preset key or template id)
 */
export function getSlugForKey(key: string): ReportSlug | undefined {
  return keyToSlugMap.get(key);
}

/**
 * Get all available report slugs
 */
export function getAllSlugs(): ReportSlug[] {
  return Array.from(slugToReportMap.keys());
}

/**
 * Get all report info entries
 */
export function getAllReports(): ReportInfo[] {
  return Array.from(slugToReportMap.values());
}

/**
 * Check if a slug is valid
 */
export function isValidSlug(slug: string): boolean {
  return slugToReportMap.has(slug);
}

