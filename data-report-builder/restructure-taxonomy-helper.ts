/**
 * Helper to restructure taxonomy from 3-level to 4-level hierarchy
 * 
 * OLD: Category → Topic → Report
 * NEW: Category → Topic → SubTopic → Report
 * 
 * Strategy: Current "reports" become "sub-topics", and their dimensions become individual reports
 */

// Example of the correct structure for Payments → Performance & Conversion:

const paymentsPerformanceConversion = {
  id: 'payments_performance_conversion',
  label: 'Performance & conversion',
  description: 'Are my customers able to pay successfully? Where do payments fail?',
  subTopics: [
    {
      id: 'acceptance_overview',
      label: 'Acceptance overview',
      description: 'Overall payment acceptance metrics across different dimensions',
      reports: [
        {
          id: 'acceptance_rate_over_time',
          label: 'Overall authorization/acceptance rate over time',
          description: 'Track acceptance rate trends by day',
          // Same base_tables, time_column, metrics as parent
          // default_dimension: 'by_day'
        },
        {
          id: 'acceptance_by_currency',
          label: 'Acceptance by currency',
          description: 'Compare acceptance rates across currencies',
          // Same base_tables, time_column, metrics as parent
          // default_dimension: 'by_currency'
        },
        {
          id: 'acceptance_by_payment_method',
          label: 'Acceptance by payment method type',
          description: 'Compare acceptance rates by payment method (card, wallet, bank debits, etc.)',
          // Same base_tables, time_column, metrics as parent
          // default_dimension: 'by_payment_method_type'
        }
      ]
    },
    {
      id: 'acceptance_by_customer_geography',
      label: 'Acceptance by customer & geography',
      description: 'Analyze acceptance by customer attributes and location',
      reports: [
        {
          id: 'acceptance_by_country',
          label: 'Acceptance by country / region',
          description: 'Compare acceptance rates by billing country',
          // default_dimension: 'by_country'
        },
        {
          id: 'acceptance_by_customer_segment',
          label: 'Acceptance by customer segment',
          description: 'Compare acceptance for new vs returning customers',
          // Needs customer join, new dimension
        },
        {
          id: 'acceptance_by_card_brand',
          label: 'Acceptance by card brand / issuing country',
          description: 'Compare acceptance by card brand and issuing country',
          // default_dimension: 'card_brand' or 'issuing_country'
        }
      ]
    },
    {
      id: 'funnel_dropoff',
      label: 'Funnel & drop-off',
      description: 'Track where payments fail in the lifecycle',
      reports: [
        {
          id: 'payment_intent_funnel',
          label: 'Payment intent funnel',
          description: 'Track payment intents through lifecycle stages (created → requires_action → succeeded)',
          // Funnel-specific metrics
        },
        {
          id: 'dropoff_by_failure_reason',
          label: 'Drop-off by failure reason',
          description: 'Analyze failure reasons (insufficient_funds, do_not_honor, etc.)',
          // Group by failure reason
        },
        {
          id: '3ds_sca_completion',
          label: '3DS / SCA completion vs abandonment',
          description: 'Track 3DS authentication completion rates',
          // 3DS-specific metrics
        }
      ]
    }
  ]
};

/**
 * Rules for conversion:
 * 1. Current "report" → becomes "subTopic"
 * 2. Each dimension in the old report → becomes a new "report" under that subTopic
 * 3. Each new report inherits: base_tables, time_column, metrics, filters
 * 4. Each new report gets ONE default_dimension set
 * 5. Report ID pattern: subtopic_dimension (e.g., "acceptance_overview_by_currency")
 */

export {};

