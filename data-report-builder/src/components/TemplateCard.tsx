// src/components/TemplateCard.tsx
'use client';
import { PresetKey } from '@/lib/presets';

type PresetConfig = {
  key: PresetKey;
  label: string;
  objects: string[];
  metric: {
    name: string;
    op: string;
    type: string;
  };
  chartType?: 'line' | 'area' | 'bar';
};

type Props = {
  template: PresetConfig;
  onSelect: () => void;
  /** Optional description override - used for taxonomy reports */
  description?: string;
};

// Map chart types to icons
const ChartIcon = ({ type }: { type: 'line' | 'area' | 'bar' }) => {
  if (type === 'bar') {
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-accent-purple"
      >
        <rect x="8" y="28" width="8" height="12" />
        <rect x="20" y="20" width="8" height="20" />
        <rect x="32" y="16" width="8" height="24" />
      </svg>
    );
  }

  if (type === 'area') {
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        className="text-accent-purple"
      >
        <path
          d="M4 40 L12 32 L20 36 L28 24 L36 28 L44 20 L44 40 Z"
          fill="currentColor"
          opacity="0.2"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  // Default line chart
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-accent-purple"
    >
      <polyline points="4,40 12,32 20,36 28,24 36,28 44,20" />
    </svg>
  );
};

// Get description for each template
const getTemplateDescription = (key: PresetKey): string => {
  const descriptions: Record<PresetKey, string> = {
    blank: 'Start from scratch',
    mrr: 'Monthly recurring revenue from active subscriptions',
    gross_volume: 'Total payment volume over time',
    active_subscribers: 'Count of active subscription customers',
    refund_count: 'Number of refunds issued per period',
    subscriber_ltv: 'Average revenue per user',
    customer_acquisition: 'New customers acquired over time',
    payment_success_rate: 'Success rate of payment attempts (succeeded ÷ total)',
    revenue_by_product: 'Revenue breakdown by product',
    payment_acceptance_by_method: 'Compare acceptance performance across payment method types',
    payment_funnel: 'Track payment intents through key lifecycle stages',
    payment_volume_by_attribute: 'Break down payment volume by currency, country, or method',
    payments_net_revenue: 'Net revenue after refunds and Stripe fees',
    first_purchase_behavior: 'Analyze value and timing of first purchases',
    active_customers: 'Count of customers who purchased in recent window',
    purchase_frequency: 'Average number of orders per customer',
    customer_ltv: 'Total charges minus refunds per customer',
    subscription_churn: 'Canceled subscriptions and lost MRR',
    invoice_status: 'Issued, paid, and overdue invoices',
    current_balances: 'Available and pending balances by currency',
    balance_flows: 'Inflows and outflows over time',
    payouts_over_time: 'Payout amounts and counts by day and currency',
    dispute_rates: 'Disputed volume and rates over time',
    disputes_by_reason: 'Disputes broken down by reason code',
    discounted_revenue: 'Revenue that used discounts vs full price',
    tax_by_jurisdiction: 'Tax collected by jurisdiction',
  };
  return descriptions[key] || '';
};

export default function TemplateCard({ template, onSelect, description }: Props) {
  // Use provided description, or fall back to preset lookup
  const displayDescription = description || getTemplateDescription(template.key);
  
  return (
    <button
      onClick={onSelect}
      className="w-full transition-all group"
      style={{
        backgroundColor: 'transparent',
        border: '1px solid var(--border-default)',
        borderRadius: '16px',
        padding: '16px',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-medium)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
      }}
    >
      {/* Content */}
      <div className="text-left" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 400 }}>
          {template.label}
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 400 }}>
          {displayDescription}
        </p>
      </div>
    </button>
  );
}

