import { SchemaCatalog, SchemaObject, Relationship } from '@/types';

const schema: SchemaCatalog = {
  objects: [
    {
      name: 'customer',
      label: 'Customer',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'email', label: 'Email', type: 'string' },
        { name: 'name', label: 'Name', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'balance', label: 'Balance', type: 'number' },
        { name: 'delinquent', label: 'Delinquent', type: 'boolean' },
      ],
    },
    {
      name: 'subscription',
      label: 'Subscription',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'customer_id', label: 'Customer ID', type: 'id' },
        { name: 'status', label: 'Status', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'current_period_start', label: 'Current Period Start', type: 'date' },
        { name: 'current_period_end', label: 'Current Period End', type: 'date' },
        { name: 'cancel_at_period_end', label: 'Cancel at Period End', type: 'boolean' },
      ],
    },
    {
      name: 'invoice',
      label: 'Invoice',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'customer_id', label: 'Customer ID', type: 'id' },
        { name: 'subscription_id', label: 'Subscription ID', type: 'id' },
        { name: 'amount_due', label: 'Amount Due', type: 'number' },
        { name: 'amount_paid', label: 'Amount Paid', type: 'number' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'status', label: 'Status', type: 'string' },
        { name: 'paid', label: 'Paid', type: 'boolean' },
      ],
    },
    {
      name: 'payment',
      label: 'Payment',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'customer_id', label: 'Customer ID', type: 'id' },
        { name: 'invoice_id', label: 'Invoice ID', type: 'id' },
        { name: 'amount', label: 'Amount', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'status', label: 'Status', type: 'string' },
        { name: 'captured', label: 'Captured', type: 'boolean' },
      ],
    },
    {
      name: 'charge',
      label: 'Charge',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'customer_id', label: 'Customer ID', type: 'id' },
        { name: 'payment_intent_id', label: 'Payment Intent ID', type: 'id' },
        { name: 'amount', label: 'Amount', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'paid', label: 'Paid', type: 'boolean' },
        { name: 'refunded', label: 'Refunded', type: 'boolean' },
      ],
    },
    {
      name: 'refund',
      label: 'Refund',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'charge_id', label: 'Charge ID', type: 'id' },
        { name: 'amount', label: 'Amount', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
        { name: 'status', label: 'Status', type: 'string' },
        { name: 'reason', label: 'Reason', type: 'string' },
      ],
    },
    {
      name: 'price',
      label: 'Price',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'product_id', label: 'Product ID', type: 'id' },
        { name: 'unit_amount', label: 'Unit Amount', type: 'number' },
        { name: 'currency', label: 'Currency', type: 'string' },
        { name: 'recurring_interval', label: 'Recurring Interval', type: 'string' },
        { name: 'active', label: 'Active', type: 'boolean' },
        { name: 'created', label: 'Created', type: 'date' },
      ],
    },
    {
      name: 'product',
      label: 'Product',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'name', label: 'Name', type: 'string' },
        { name: 'description', label: 'Description', type: 'string' },
        { name: 'active', label: 'Active', type: 'boolean' },
        { name: 'created', label: 'Created', type: 'date' },
      ],
    },
    {
      name: 'subscription_item',
      label: 'Subscription Item',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'subscription_id', label: 'Subscription ID', type: 'id' },
        { name: 'price_id', label: 'Price ID', type: 'id' },
        { name: 'quantity', label: 'Quantity', type: 'number' },
        { name: 'created', label: 'Created', type: 'date' },
      ],
    },
    {
      name: 'payment_method',
      label: 'Payment Method',
      fields: [
        { name: 'id', label: 'ID', type: 'id' },
        { name: 'customer_id', label: 'Customer ID', type: 'id' },
        { name: 'type', label: 'Type', type: 'string' },
        { name: 'card_brand', label: 'Card Brand', type: 'string' },
        { name: 'card_last4', label: 'Card Last 4', type: 'string' },
        { name: 'created', label: 'Created', type: 'date' },
      ],
    },
  ],
  relationships: [
    {
      from: 'customer',
      to: 'subscription',
      type: 'one-to-many',
      via: 'customer_id',
      description: 'A customer can have multiple subscriptions',
    },
    {
      from: 'customer',
      to: 'invoice',
      type: 'one-to-many',
      via: 'customer_id',
      description: 'A customer can have multiple invoices',
    },
    {
      from: 'customer',
      to: 'payment',
      type: 'one-to-many',
      via: 'customer_id',
      description: 'A customer can have multiple payments',
    },
    {
      from: 'customer',
      to: 'charge',
      type: 'one-to-many',
      via: 'customer_id',
      description: 'A customer can have multiple charges',
    },
    {
      from: 'customer',
      to: 'payment_method',
      type: 'one-to-many',
      via: 'customer_id',
      description: 'A customer can have multiple payment methods',
    },
    {
      from: 'subscription',
      to: 'invoice',
      type: 'one-to-many',
      via: 'subscription_id',
      description: 'A subscription can have multiple invoices',
    },
    {
      from: 'subscription',
      to: 'subscription_item',
      type: 'one-to-many',
      via: 'subscription_id',
      description: 'A subscription can have multiple items',
    },
    {
      from: 'invoice',
      to: 'payment',
      type: 'one-to-many',
      via: 'invoice_id',
      description: 'An invoice can have multiple payments',
    },
    {
      from: 'payment',
      to: 'charge',
      type: 'one-to-many',
      via: 'payment_intent_id',
      description: 'A payment can have multiple charges',
    },
    {
      from: 'charge',
      to: 'refund',
      type: 'one-to-many',
      via: 'charge_id',
      description: 'A charge can have multiple refunds',
    },
    {
      from: 'product',
      to: 'price',
      type: 'one-to-many',
      via: 'product_id',
      description: 'A product can have multiple prices',
    },
    {
      from: 'price',
      to: 'subscription_item',
      type: 'one-to-many',
      via: 'price_id',
      description: 'A price can be used in multiple subscription items',
    },
  ],
};

export const getObject = (name: string): SchemaObject | undefined => {
  return schema.objects.find(obj => obj.name === name);
};

export const getRelated = (name: string): Relationship[] => {
  return schema.relationships.filter(
    rel => rel.from === name || rel.to === name
  );
};

export default schema;
