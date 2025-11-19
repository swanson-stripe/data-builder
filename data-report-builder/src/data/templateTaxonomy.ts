// Template taxonomy for waterfall category filtering
// Defines the hierarchical structure: Category → Topic → Report

// Base table definition for SQL generation
export interface BaseTable {
  alias: string;
  table: string;
  join_on?: string;
  join_type?: 'left' | 'right' | 'inner';
}

// Metric definition
export interface ReportMetric {
  id: string;
  label: string;
  expression: string;
  type: 'integer' | 'currency' | 'ratio' | 'float';
  note?: string;
}

// Dimension definition for grouping
export interface ReportDimension {
  id: string;
  label: string;
  column: string | null;
  table: string | null;
  expression?: string;
}

// Filter definition
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

// Order by definition
export interface ReportOrderBy {
  expression: string;
  direction: 'asc' | 'desc';
}

// Complete report template
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

// Topic groups related reports
export interface TemplateTopic {
  id: string;
  label: string;
  description: string;
  reports: TemplateReport[];
}

// Top-level category
export interface TemplateCategory {
  id: string;
  label: string;
  description: string;
  topics: TemplateTopic[];
}

// Full taxonomy structure
export const TEMPLATE_TAXONOMY: TemplateCategory[] = [
  {
    id: 'payments',
    label: 'Payments',
    description: 'Understand payment performance, volume, refunds, and economics.',
    topics: [
      {
        id: 'payments_performance_conversion',
        label: 'Performance & conversion',
        description: 'Are my customers able to pay successfully? Where do payments fail?',
        reports: [
          {
            id: 'payments_acceptance_overview',
            label: 'Acceptance overview',
            description: 'Overall payment acceptance and failure reasons over time.',
            base_tables: [
              { alias: 'pi', table: 'payment_intents' },
              { alias: 'pm', table: 'payment_methods', join_on: 'pi.payment_method_id = pm.id', join_type: 'left' }
            ],
            time_column: 'pi.created',
            metrics: [
              { id: 'attempts', label: 'Payment attempts', expression: 'COUNT(*)', type: 'integer' },
              { id: 'succeeded_payments', label: 'Succeeded payments', expression: 'SUM(CASE WHEN pi.status = \'succeeded\' THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'acceptance_rate', label: 'Acceptance rate', expression: 'SAFE_DIVIDE(SUM(CASE WHEN pi.status = \'succeeded\' THEN 1 ELSE 0 END), COUNT(*))', type: 'ratio' },
              { id: 'failed_payments', label: 'Failed payments', expression: 'SUM(CASE WHEN pi.status = \'requires_payment_method\' OR pi.status = \'canceled\' THEN 1 ELSE 0 END)', type: 'integer' }
            ],
            dimensions: [
              { id: 'none', label: 'No breakdown', column: null, table: null },
              { id: 'by_day', label: 'By day', expression: 'DATE(pi.created)', column: null, table: null },
              { id: 'by_currency', label: 'By currency', column: 'currency', table: 'pi' },
              { id: 'by_payment_method_type', label: 'By payment method type', column: 'type', table: 'pm' },
              { id: 'by_country', label: 'By billing country', column: 'billing_details_address_country', table: 'pm' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Payment created date', type: 'daterange', column: 'pi.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: [
              { id: 'currency', label: 'Currency', type: 'enum', column: 'pi.currency', operator: 'in', param: 'currency_list' },
              { id: 'country', label: 'Billing country', type: 'country', column: 'pm.billing_details_address_country', operator: 'in', param: 'country_list' }
            ],
            default_order_by: [{ expression: 'DATE(pi.created)', direction: 'asc' }]
          },
          {
            id: 'payments_acceptance_by_method',
            label: 'Acceptance by payment method',
            description: 'Compare acceptance performance across payment method types and brands.',
            base_tables: [
              { alias: 'pi', table: 'payment_intents' },
              { alias: 'pm', table: 'payment_methods', join_on: 'pi.payment_method_id = pm.id', join_type: 'left' }
            ],
            time_column: 'pi.created',
            metrics: [
              { id: 'attempts', label: 'Payment attempts', expression: 'COUNT(*)', type: 'integer' },
              { id: 'succeeded', label: 'Succeeded', expression: 'SUM(CASE WHEN pi.status = \'succeeded\' THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'acceptance_rate', label: 'Acceptance rate', expression: 'SAFE_DIVIDE(SUM(CASE WHEN pi.status = \'succeeded\' THEN 1 ELSE 0 END), COUNT(*))', type: 'ratio' }
            ],
            dimensions: [
              { id: 'payment_method_type', label: 'Payment method type', column: 'type', table: 'pm' },
              { id: 'card_brand', label: 'Card brand', column: 'card_brand', table: 'pm' },
              { id: 'country', label: 'Billing country', column: 'billing_details_address_country', table: 'pm' }
            ],
            default_dimension: 'payment_method_type',
            required_filters: [
              { id: 'date_range', label: 'Payment created date', type: 'daterange', column: 'pi.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: [
              { id: 'currency', label: 'Currency', type: 'enum', column: 'pi.currency', operator: 'in', param: 'currency_list' }
            ]
          },
          {
            id: 'payments_funnel',
            label: 'Payment funnel (intent lifecycle)',
            description: 'Track payment intents through key lifecycle stages to see where users drop off.',
            base_tables: [
              { alias: 'pi', table: 'payment_intents' }
            ],
            time_column: 'pi.created',
            metrics: [
              { id: 'created', label: 'Created', expression: 'SUM(CASE WHEN pi.status IS NOT NULL THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'requires_action', label: 'Requires action', expression: 'SUM(CASE WHEN pi.status = \'requires_action\' THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'requires_payment_method', label: 'Requires payment method', expression: 'SUM(CASE WHEN pi.status = \'requires_payment_method\' THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'succeeded', label: 'Succeeded', expression: 'SUM(CASE WHEN pi.status = \'succeeded\' THEN 1 ELSE 0 END)', type: 'integer' },
              { id: 'canceled', label: 'Canceled', expression: 'SUM(CASE WHEN pi.status = \'canceled\' THEN 1 ELSE 0 END)', type: 'integer' }
            ],
            dimensions: [
              { id: 'by_day', label: 'By day', expression: 'DATE(pi.created)', column: null, table: null },
              { id: 'by_country', label: 'By customer country (if available)', column: 'metadata_country', table: 'pi' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Payment intent created date', type: 'daterange', column: 'pi.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          }
        ]
      },
      {
        id: 'payments_volume_mix',
        label: 'Volume & mix',
        description: 'How much volume do I process, and along which dimensions?',
        reports: [
          {
            id: 'payments_volume_over_time',
            label: 'Payment volume over time',
            description: 'Track gross payment volume, count, and average order value over time.',
            base_tables: [
              { alias: 'ch', table: 'charges' }
            ],
            time_column: 'ch.created',
            metrics: [
              { id: 'gross_volume', label: 'Gross volume', expression: 'SUM(ch.amount) / 100.0', type: 'currency' },
              { id: 'payment_count', label: 'Payment count', expression: 'COUNT(*)', type: 'integer' },
              { id: 'avg_order_value', label: 'Average order value', expression: 'SAFE_DIVIDE(SUM(ch.amount), COUNT(*)) / 100.0', type: 'currency' }
            ],
            dimensions: [
              { id: 'by_day', label: 'By day', expression: 'DATE(ch.created)', column: null, table: null },
              { id: 'by_week', label: 'By ISO week', expression: 'DATE_TRUNC(DATE(ch.created), WEEK)', column: null, table: null },
              { id: 'by_currency', label: 'By currency', column: 'currency', table: 'ch' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Charge created date', type: 'daterange', column: 'ch.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: [
              { id: 'succeeded_only', label: 'Succeeded charges only', type: 'boolean', column: 'ch.status', operator: '=', param: 'status', default_value: 'succeeded' }
            ]
          },
          {
            id: 'payments_volume_by_attribute',
            label: 'Payment volume by attribute',
            description: 'Break down payment volume by currency, country, payment method, or product.',
            base_tables: [
              { alias: 'ch', table: 'charges' },
              { alias: 'pm', table: 'payment_methods', join_on: 'ch.payment_method_id = pm.id', join_type: 'left' },
              { alias: 'il', table: 'invoice_line_items', join_on: 'ch.invoice_id = il.invoice_id', join_type: 'left' },
              { alias: 'pr', table: 'products', join_on: 'il.product_id = pr.id', join_type: 'left' }
            ],
            time_column: 'ch.created',
            metrics: [
              { id: 'gross_volume', label: 'Gross volume', expression: 'SUM(ch.amount) / 100.0', type: 'currency' },
              { id: 'payment_count', label: 'Payment count', expression: 'COUNT(DISTINCT ch.id)', type: 'integer' }
            ],
            dimensions: [
              { id: 'currency', label: 'Currency', column: 'currency', table: 'ch' },
              { id: 'billing_country', label: 'Billing country', column: 'billing_details_address_country', table: 'ch' },
              { id: 'payment_method_type', label: 'Payment method type', column: 'type', table: 'pm' },
              { id: 'product', label: 'Product', column: 'name', table: 'pr' }
            ],
            default_dimension: 'currency',
            required_filters: [
              { id: 'date_range', label: 'Charge created date', type: 'daterange', column: 'ch.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          }
        ]
      },
      {
        id: 'payments_refunds_costs',
        label: 'Refunds & net revenue',
        description: 'How much value do I lose to refunds and fees, and what is my net revenue?',
        reports: [
          {
            id: 'refund_rate_over_time',
            label: 'Refund rate over time',
            description: 'Compare refunded volume to original charges over time.',
            base_tables: [
              { alias: 'ch', table: 'charges' },
              { alias: 'rf', table: 'refunds', join_on: 'rf.charge_id = ch.id', join_type: 'left' }
            ],
            time_column: 'ch.created',
            metrics: [
              { id: 'gross_volume', label: 'Gross volume', expression: 'SUM(ch.amount) / 100.0', type: 'currency' },
              { id: 'refund_volume', label: 'Refund volume', expression: 'SUM(COALESCE(rf.amount, 0)) / 100.0', type: 'currency' },
              { id: 'refund_rate', label: 'Refund rate', expression: 'SAFE_DIVIDE(SUM(COALESCE(rf.amount, 0)), SUM(ch.amount))', type: 'ratio' }
            ],
            dimensions: [
              { id: 'by_day', label: 'By day', expression: 'DATE(ch.created)', column: null, table: null },
              { id: 'by_currency', label: 'By currency', column: 'currency', table: 'ch' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Charge created date', type: 'daterange', column: 'ch.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          },
          {
            id: 'payments_net_revenue',
            label: 'Net revenue from payments',
            description: 'Estimate net revenue after refunds and Stripe fees using balance transactions.',
            base_tables: [
              { alias: 'bt', table: 'balance_transactions' }
            ],
            time_column: 'bt.created',
            metrics: [
              { id: 'gross_charges', label: 'Gross charges', expression: 'SUM(CASE WHEN bt.type = \'charge\' THEN bt.amount ELSE 0 END) / 100.0', type: 'currency' },
              { id: 'refunds', label: 'Refunds', expression: 'SUM(CASE WHEN bt.type IN (\'refund\', \'charge_refund\') THEN bt.amount ELSE 0 END) / 100.0', type: 'currency' },
              { id: 'fees', label: 'Fees', expression: 'SUM(CASE WHEN bt.reporting_category = \'charge_fee\' THEN bt.amount ELSE 0 END) / 100.0', type: 'currency' },
              { id: 'net', label: 'Net amount', expression: 'SUM(bt.net) / 100.0', type: 'currency' }
            ],
            dimensions: [
              { id: 'by_day', label: 'By day', expression: 'DATE(bt.created)', column: null, table: null },
              { id: 'by_currency', label: 'By currency', column: 'currency', table: 'bt' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Balance transaction created date', type: 'daterange', column: 'bt.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          }
        ]
      }
    ]
  },
  {
    id: 'customers',
    label: 'Customers',
    description: 'Understand who your customers are, how they behave, and how valuable they are.',
    topics: [
      {
        id: 'customers_acquisition',
        label: 'Acquisition & growth',
        description: 'Track new customers and how they first transact.',
        reports: [
          {
            id: 'new_customers_over_time',
            label: 'New customers over time',
            description: 'Count new customers by day, country, and primary currency.',
            base_tables: [
              { alias: 'c', table: 'customers' }
            ],
            time_column: 'c.created',
            metrics: [
              { id: 'new_customers', label: 'New customers', expression: 'COUNT(*)', type: 'integer' }
            ],
            dimensions: [
              { id: 'by_day', label: 'By day', expression: 'DATE(c.created)', column: null, table: null },
              { id: 'by_country', label: 'By country', column: 'address_country', table: 'c' },
              { id: 'by_currency', label: 'By default currency', column: 'currency', table: 'c' }
            ],
            default_dimension: 'by_day',
            required_filters: [
              { id: 'date_range', label: 'Customer created date', type: 'daterange', column: 'c.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          }
        ]
      }
    ]
  },
  {
    id: 'subscriptions_invoicing',
    label: 'Subscriptions & Invoicing',
    description: 'Track recurring revenue, churn, and invoice health.',
    topics: [
      {
        id: 'subscriptions_revenue',
        label: 'Recurring revenue & growth',
        description: 'MRR/ARR and subscription counts over time.',
        reports: [
          {
            id: 'mrr_by_plan',
            label: 'MRR by plan',
            description: 'Monthly recurring revenue by subscription plan (price).',
            base_tables: [
              { alias: 's', table: 'subscriptions' },
              { alias: 'si', table: 'subscription_items', join_on: 'si.subscription_id = s.id', join_type: 'inner' },
              { alias: 'p', table: 'prices', join_on: 'si.price_id = p.id', join_type: 'inner' }
            ],
            time_column: 's.current_period_start',
            metrics: [
              { id: 'mrr', label: 'MRR', expression: 'SUM(CASE WHEN p.recurring_interval = \'month\' THEN p.unit_amount * si.quantity WHEN p.recurring_interval = \'year\' THEN (p.unit_amount * si.quantity) / 12 ELSE 0 END) / 100.0', type: 'currency' },
              { id: 'active_subscriptions', label: 'Active subscriptions', expression: 'COUNT(DISTINCT CASE WHEN s.status = \'active\' THEN s.id END)', type: 'integer' }
            ],
            dimensions: [
              { id: 'by_month', label: 'By month (period start)', expression: 'DATE_TRUNC(DATE(s.current_period_start), MONTH)', column: null, table: null },
              { id: 'plan', label: 'Plan / price', column: 'nickname', table: 'p' }
            ],
            default_dimension: 'by_month',
            required_filters: [
              { id: 'period_start_range', label: 'Current period start', type: 'daterange', column: 's.current_period_start', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: [
              { id: 'subscription_status', label: 'Subscription status', type: 'enum', column: 's.status', operator: 'in', param: 'status_list' }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'balances_payouts',
    label: 'Balances & Payouts',
    description: 'Understand where funds are, how they move, and when you get paid.',
    topics: []
  },
  {
    id: 'disputes_risk',
    label: 'Disputes & Risk',
    description: 'Monitor disputes and fraud-related behavior.',
    topics: []
  },
  {
    id: 'products_pricing_tax',
    label: 'Products, Pricing & Tax',
    description: 'Which products drive your revenue, and how do discounts and tax behave?',
    topics: [
      {
        id: 'product_performance',
        label: 'Product performance',
        description: 'Revenue and units sold per product.',
        reports: [
          {
            id: 'revenue_by_product',
            label: 'Revenue by product',
            description: 'Volume and units by product, using invoice line items.',
            base_tables: [
              { alias: 'il', table: 'invoice_line_items' },
              { alias: 'inv', table: 'invoices', join_on: 'il.invoice_id = inv.id', join_type: 'inner' },
              { alias: 'pr', table: 'products', join_on: 'il.product_id = pr.id', join_type: 'left' }
            ],
            time_column: 'inv.created',
            metrics: [
              { id: 'revenue', label: 'Revenue', expression: 'SUM(il.amount) / 100.0', type: 'currency' },
              { id: 'units', label: 'Units', expression: 'SUM(il.quantity)', type: 'integer' }
            ],
            dimensions: [
              { id: 'product', label: 'Product', column: 'name', table: 'pr' },
              { id: 'by_month', label: 'By month (invoice created)', expression: 'DATE_TRUNC(DATE(inv.created), MONTH)', column: null, table: null }
            ],
            default_dimension: 'product',
            required_filters: [
              { id: 'invoice_date_range', label: 'Invoice created date', type: 'daterange', column: 'inv.created', operator: 'between', param_from: 'start_date', param_to: 'end_date' }
            ],
            optional_filters: []
          }
        ]
      }
    ]
  }
];

