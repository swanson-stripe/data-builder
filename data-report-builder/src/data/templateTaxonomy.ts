// Template taxonomy for waterfall category filtering
// Defines the hierarchical structure: Category → Topic → Report

// These interfaces match the PresetConfig structure for seamless integration
export interface TemplateReport {
  id: string;
  label: string;
  description: string;
  objects: string[];
  fields: Array<{
    object: string;
    field: string;
    required: boolean;
  }>;
  metric: {
    name: string;
    source?: {
      object: string;
      field: string;
    };
    op: 'count' | 'sum' | 'avg';
    type: 'sum_over_period' | 'latest' | 'average_over_period';
  };
  multiBlock?: {
    blocks: Array<{
      id: string;
      name: string;
      source: {
        object: string;
        field: string;
      };
      op: 'count' | 'sum' | 'avg';
      type: 'sum_over_period' | 'latest' | 'average_over_period';
      filters: Array<{
        field: {
          object: string;
          field: string;
        };
        operator: string;
        value: any;
      }>;
    }>;
    calculation: {
      operator: 'divide' | 'multiply' | 'add' | 'subtract';
      leftOperand: string;
      rightOperand: string;
      resultUnitType: 'percentage' | 'currency' | 'number';
    };
    outputUnit: 'rate' | 'currency' | 'number';
  };
  range?: {
    start: string;
    end: string;
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
  filters?: Array<{
    field: {
      object: string;
      field: string;
    };
    operator: string;
    value: any;
  }>;
  chartType?: 'line' | 'bar';
  defaultSort?: {
    column: string;
    direction: 'asc' | 'desc';
  };
  groupBy?: {
    field: {
      object: string;
      field: string;
    };
    selectedValues: any[];
  };
}

export interface TemplateTopic {
  id: string;
  label: string;
  description: string;
  reports: TemplateReport[];
}

export interface TemplateCategory {
  id: string;
  label: string;
  description: string;
  topics: TemplateTopic[];
}

export const TEMPLATE_TAXONOMY: TemplateCategory[] = [
  {
    "id": "payments",
    "label": "Payments",
    "description": "What's happening with my payments, and why?",
    "topics": [
      {
        "id": "payments_performance_conversion",
        "label": "Performance & conversion",
        "description": "How often payments succeed or fail.",
        "reports": [
          {
            "id": "payments_acceptance_overview",
            "label": "Payment acceptance rate",
            "description": "Rate of successful payments to total attempts",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "currency",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Payment acceptance rate",
              "source": {
                "object": "charge",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "successful_payments",
                  "name": "Payment acceptance rate",
                  "source": {
                    "object": "charge",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "charge",
                        "field": "status"
                      },
                      "operator": "equals",
                      "value": "succeeded"
                    }
                  ]
                },
                {
                  "id": "total_payments",
                  "name": "Total payments",
                  "source": {
                    "object": "charge",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": []
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "successful_payments",
                "rightOperand": "total_payments",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          },
          {
            "id": "payments_acceptance_by_method",
            "label": "Payment acceptance rate by payment method",
            "description": "Acceptance rates across payment methods and card brands",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "currency",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "payment_method_details_type",
                "required": true
              },
              {
                "object": "charge",
                "field": "payment_method_details_card_brand",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Payment acceptance rate by payment method",
              "source": {
                "object": "charge",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "successful_method_payments",
                  "name": "Payment acceptance rate by payment method",
                  "source": {
                    "object": "charge",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "charge",
                        "field": "status"
                      },
                      "operator": "equals",
                      "value": "succeeded"
                    }
                  ]
                },
                {
                  "id": "total_method_payments",
                  "name": "Total payments",
                  "source": {
                    "object": "charge",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": []
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "successful_method_payments",
                "rightOperand": "total_method_payments",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "charge.payment_method_details_type",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "charge",
                "field": "payment_method_details_type"
              },
              "selectedValues": []
            }
          },
          {
            "id": "payments_intent_funnel",
            "label": "Payments count by status",
            "description": "Count of payments by status over time",
            "objects": [
              "payment_intent"
            ],
            "fields": [
              {
                "object": "payment_intent",
                "field": "id",
                "required": true
              },
              {
                "object": "payment_intent",
                "field": "amount",
                "required": false
              },
              {
                "object": "payment_intent",
                "field": "currency",
                "required": false
              },
              {
                "object": "payment_intent",
                "field": "status",
                "required": true
              },
              {
                "object": "payment_intent",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Payments count by status",
              "source": {
                "object": "payment_intent",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "payment_intent.status",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "payment_intent",
                "field": "status"
              },
              "selectedValues": []
            }
          }
        ]
      },
      {
        "id": "payments_volume_mix",
        "label": "Volume & mix",
        "description": "How much volume you process and where it comes from.",
        "reports": [
          {
            "id": "payments_volume_over_time",
            "label": "Successful payments volume",
            "description": "Total volume from successful payments",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "currency",
                "required": true
              },
              {
                "object": "charge",
                "field": "status",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Successful payments volume",
              "source": {
                "object": "charge",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          },
          {
            "id": "payments_volume_by_method",
            "label": "Payments volume by payment method",
            "description": "Volume breakdown by payment method type",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "currency",
                "required": true
              },
              {
                "object": "charge",
                "field": "payment_method_details_type",
                "required": true
              },
              {
                "object": "charge",
                "field": "status",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Payments volume by payment method",
              "source": {
                "object": "charge",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "bar",
            "defaultSort": {
              "column": "charge.payment_method_details_type",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "charge",
                "field": "payment_method_details_type"
              },
              "selectedValues": []
            }
          },
          {
            "id": "payments_volume_by_product",
            "label": "Payments volume by product",
            "description": "Volume breakdown by product",
            "objects": [
              "charge",
              "product"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "currency",
                "required": true
              },
              {
                "object": "charge",
                "field": "product_id",
                "required": true
              },
              {
                "object": "charge",
                "field": "status",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              },
              {
                "object": "product",
                "field": "id",
                "required": true
              },
              {
                "object": "product",
                "field": "name",
                "required": true
              }
            ],
            "metric": {
              "name": "Payments volume by product",
              "source": {
                "object": "charge",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "product",
                "field": "name"
              },
              "selectedValues": []
            }
          }
        ]
      },
      {
        "id": "payments_refunds_net_revenue",
        "label": "Refunds & net revenue",
        "description": "Value lost to refunds and overall net income.",
        "reports": [
          {
            "id": "payments_refund_rate_over_time",
            "label": "Refund rate",
            "description": "Rate of refunds relative to successful payments",
            "objects": [
              "charge",
              "refund"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "currency",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              },
              {
                "object": "refund",
                "field": "id",
                "required": false
              },
              {
                "object": "refund",
                "field": "amount",
                "required": true
              },
              {
                "object": "refund",
                "field": "created",
                "required": false
              }
            ],
            "metric": {
              "name": "Refund rate",
              "source": {
                "object": "refund",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "refund_volume",
                  "name": "Refund rate",
                  "source": {
                    "object": "refund",
                    "field": "amount"
                  },
                  "op": "sum",
                  "type": "sum_over_period",
                  "filters": []
                },
                {
                  "id": "charge_volume",
                  "name": "Charge volume",
                  "source": {
                    "object": "charge",
                    "field": "amount"
                  },
                  "op": "sum",
                  "type": "sum_over_period",
                  "filters": []
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "refund_volume",
                "rightOperand": "charge_volume",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          },
          {
            "id": "payments_refunds_by_driver",
            "label": "Refund volume by reason",
            "description": "Refund amounts broken down by reason code",
            "objects": [
              "refund"
            ],
            "fields": [
              {
                "object": "refund",
                "field": "id",
                "required": true
              },
              {
                "object": "refund",
                "field": "amount",
                "required": true
              },
              {
                "object": "refund",
                "field": "reason",
                "required": true
              },
              {
                "object": "refund",
                "field": "currency",
                "required": true
              },
              {
                "object": "refund",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Refund volume by reason",
              "source": {
                "object": "refund",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "refund.reason",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "refund",
                "field": "reason"
              },
              "selectedValues": []
            }
          },
          {
            "id": "payments_net_revenue_over_time",
            "label": "Net volume",
            "description": "Revenue after refunds and fees",
            "objects": [
              "balance_transaction"
            ],
            "fields": [
              {
                "object": "balance_transaction",
                "field": "id",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "amount",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "net",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "currency",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "type",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Net volume",
              "source": {
                "object": "balance_transaction",
                "field": "net"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "balance_transaction",
                  "field": "type"
                },
                "operator": "in",
                "value": [
                  "charge",
                  "refund",
                  "adjustment"
                ]
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "balance_transaction.created",
              "direction": "desc"
            }
          }
        ]
      },
      {
        "id": "payments_fees_pricing",
        "label": "Fees, pricing & tax",
        "description": "Processing fees and pricing/tax behavior.",
        "reports": [
          {
            "id": "payments_fees_over_time",
            "label": "Fee volume",
            "description": "Total Stripe processing fees over time",
            "objects": [
              "balance_transaction"
            ],
            "fields": [
              {
                "object": "balance_transaction",
                "field": "id",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "amount",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "currency",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "reporting_category",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Fee volume",
              "source": {
                "object": "balance_transaction",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "balance_transaction",
                  "field": "reporting_category"
                },
                "operator": "equals",
                "value": "charge_fee"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "balance_transaction.created",
              "direction": "desc"
            }
          },
          {
            "id": "payments_fees_by_dimension",
            "label": "Fees by payment method",
            "description": "Fee breakdown by payment method and card brand",
            "objects": [
              "charge",
              "balance_transaction"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "payment_method_details_type",
                "required": true
              },
              {
                "object": "charge",
                "field": "payment_method_details_card_brand",
                "required": false
              },
              {
                "object": "charge",
                "field": "billing_details_address_country",
                "required": false
              },
              {
                "object": "balance_transaction",
                "field": "amount",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "currency",
                "required": true
              },
              {
                "object": "balance_transaction",
                "field": "reporting_category",
                "required": true
              }
            ],
            "metric": {
              "name": "Fees by payment method",
              "source": {
                "object": "balance_transaction",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "balance_transaction",
                  "field": "reporting_category"
                },
                "operator": "equals",
                "value": "charge_fee"
              }
            ],
            "chartType": "bar",
            "defaultSort": {
              "column": "charge.payment_method_details_type",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "charge",
                "field": "payment_method_details_type"
              },
              "selectedValues": []
            }
          }
        ]
      }
    ]
  },
  {
    "id": "customers",
    "label": "Customers",
    "description": "Who your customers are, how they behave over time, and how valuable they are.",
    "topics": [
      {
        "id": "customers_acquisition_growth",
        "label": "Acquisition & growth",
        "description": "How you acquire and onboard new customers.",
        "reports": [
          {
            "id": "customers_new_over_time",
            "label": "New customers",
            "description": "New customers acquired over time",
            "objects": [
              "customer",
              "charge"
            ],
            "fields": [
              {
                "object": "customer",
                "field": "id",
                "required": true
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "customer",
                "field": "created",
                "required": true
              },
              {
                "object": "charge",
                "field": "id",
                "required": false
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": false
              }
            ],
            "metric": {
              "name": "New customers",
              "source": {
                "object": "customer",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "customer.created",
              "direction": "desc"
            }
          },
          {
            "id": "customers_new_by_geography",
            "label": "New customers by country",
            "description": "Customer acquisition breakdown by country",
            "objects": [
              "customer"
            ],
            "fields": [
              {
                "object": "customer",
                "field": "id",
                "required": true
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "customer",
                "field": "address_country",
                "required": true
              },
              {
                "object": "customer",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "New customers by country",
              "source": {
                "object": "customer",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "customer.address_country",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "customer",
                "field": "address_country"
              },
              "selectedValues": []
            }
          },
          {
            "id": "customers_first_purchase_behavior",
            "label": "New customer volume",
            "description": "Revenue from first-time customer purchases",
            "objects": [
              "customer",
              "charge"
            ],
            "fields": [
              {
                "object": "customer",
                "field": "id",
                "required": true
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "customer",
                "field": "created",
                "required": true
              },
              {
                "object": "charge",
                "field": "id",
                "required": false
              },
              {
                "object": "charge",
                "field": "customer_id",
                "required": false
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "currency",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": false
              },
              {
                "object": "charge",
                "field": "created",
                "required": false
              }
            ],
            "metric": {
              "name": "New customer volume",
              "source": {
                "object": "charge",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "customer.created",
              "direction": "desc"
            }
          }
        ]
      },
      {
        "id": "customers_engagement_activity",
        "label": "Engagement & activity",
        "description": "How often customers return and keep buying.",
        "reports": [
          {
            "id": "customers_active_vs_inactive",
            "label": "Unique customer purchases",
            "description": "Count of customers with purchases in period",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "customer_id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "currency",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Unique customer purchases",
              "source": {
                "object": "charge",
                "field": "customer_id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          },
          {
            "id": "customers_purchase_frequency",
            "label": "Customer purchase frequency",
            "description": "Average number of purchases per customer",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "customer_id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": false
              },
              {
                "object": "charge",
                "field": "currency",
                "required": false
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Customer purchase frequency",
              "source": {
                "object": "charge",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          }
        ]
      },
      {
        "id": "customers_value_segmentation",
        "label": "Value & segmentation",
        "description": "Which customers and segments are most valuable.",
        "reports": [
          {
            "id": "customers_ltv_overview",
            "label": "Customer LTV",
            "description": "Total lifetime value per customer",
            "objects": [
              "charge"
            ],
            "fields": [
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "customer_id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "currency",
                "required": true
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "paid",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Customer LTV",
              "source": {
                "object": "charge",
                "field": "amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              },
              {
                "field": {
                  "object": "charge",
                  "field": "paid"
                },
                "operator": "equals",
                "value": true
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.customer_id",
              "direction": "desc"
            }
          },
          {
            "id": "customers_top_spenders",
            "label": "High value customers",
            "description": "Customers who have spent over $5,000",
            "objects": [
              "customer",
              "charge"
            ],
            "fields": [
              {
                "object": "customer",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "id",
                "required": true
              },
              {
                "object": "charge",
                "field": "customer_id",
                "required": true
              },
              {
                "object": "charge",
                "field": "amount",
                "required": true
              },
              {
                "object": "charge",
                "field": "status",
                "required": true
              },
              {
                "object": "charge",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "High value customers",
              "source": {
                "object": "customer",
                "field": "id"
              },
              "op": "count",
              "type": "latest"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "charge",
                  "field": "status"
                },
                "operator": "equals",
                "value": "succeeded"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "charge.created",
              "direction": "desc"
            }
          },
          {
            "id": "customers_revenue_by_cohort_segment",
            "label": "Customers by country",
            "description": "Customer distribution across countries",
            "objects": [
              "customer"
            ],
            "fields": [
              {
                "object": "customer",
                "field": "id",
                "required": true
              },
              {
                "object": "customer",
                "field": "created",
                "required": true
              },
              {
                "object": "customer",
                "field": "address_country",
                "required": true
              }
            ],
            "metric": {
              "name": "Customers by country",
              "source": {
                "object": "customer",
                "field": "id"
              },
              "op": "count",
              "type": "latest"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "customer.created",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "customer",
                "field": "address_country"
              },
              "selectedValues": []
            }
          }
        ]
      }
    ]
  },
  {
    "id": "subscriptions_invoicing",
    "label": "Subscriptions & Invoicing",
    "description": "How your recurring business is performing: MRR/ARR, churn, billing, and trials.",
    "topics": [
      {
        "id": "subs_recurring_revenue_growth",
        "label": "Recurring revenue & growth",
        "description": "MRR/ARR levels and subscription growth.",
        "reports": [
          {
            "id": "subs_mrr_arr_over_time",
            "label": "MRR",
            "description": "Monthly recurring revenue from active subscriptions",
            "objects": [
              "subscription",
              "customer",
              "subscription_item",
              "price"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "current_period_start",
                "required": true
              },
              {
                "object": "subscription",
                "field": "current_period_end",
                "required": true
              },
              {
                "object": "customer",
                "field": "id",
                "required": false
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "subscription_item",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "quantity",
                "required": false
              },
              {
                "object": "price",
                "field": "unit_amount",
                "required": true
              },
              {
                "object": "price",
                "field": "currency",
                "required": true
              },
              {
                "object": "price",
                "field": "recurring_interval",
                "required": true
              }
            ],
            "metric": {
              "name": "Monthly Recurring Revenue (MRR)",
              "source": {
                "object": "price",
                "field": "unit_amount"
              },
              "op": "sum",
              "type": "latest"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "subscription",
                  "field": "status"
                },
                "operator": "equals",
                "value": "active"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.current_period_start",
              "direction": "desc"
            }
          },
          {
            "id": "subs_mrr_by_plan",
            "label": "MRR by product",
            "description": "Monthly recurring revenue breakdown by product",
            "objects": [
              "subscription",
              "customer",
              "subscription_item",
              "price",
              "product"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "current_period_start",
                "required": true
              },
              {
                "object": "subscription",
                "field": "current_period_end",
                "required": true
              },
              {
                "object": "customer",
                "field": "id",
                "required": false
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "subscription_item",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "quantity",
                "required": false
              },
              {
                "object": "price",
                "field": "unit_amount",
                "required": true
              },
              {
                "object": "price",
                "field": "currency",
                "required": true
              },
              {
                "object": "price",
                "field": "recurring_interval",
                "required": true
              },
              {
                "object": "price",
                "field": "product_id",
                "required": true
              },
              {
                "object": "product",
                "field": "id",
                "required": true
              },
              {
                "object": "product",
                "field": "name",
                "required": true
              }
            ],
            "metric": {
              "name": "MRR by product",
              "source": {
                "object": "price",
                "field": "unit_amount"
              },
              "op": "sum",
              "type": "latest"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "subscription",
                  "field": "status"
                },
                "operator": "equals",
                "value": "active"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.current_period_start",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "product",
                "field": "name"
              },
              "selectedValues": []
            }
          },
          {
            "id": "subs_subscription_counts_over_time",
            "label": "Active Subscribers",
            "description": "Count of active subscriptions over time",
            "objects": [
              "subscription",
              "customer",
              "invoice"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "current_period_end",
                "required": true
              },
              {
                "object": "subscription",
                "field": "cancel_at_period_end",
                "required": false
              },
              {
                "object": "customer",
                "field": "id",
                "required": false
              },
              {
                "object": "customer",
                "field": "email",
                "required": false
              },
              {
                "object": "invoice",
                "field": "id",
                "required": false
              },
              {
                "object": "invoice",
                "field": "amount_paid",
                "required": false
              },
              {
                "object": "invoice",
                "field": "created",
                "required": false
              }
            ],
            "metric": {
              "name": "Active Subscribers",
              "source": {
                "object": "subscription",
                "field": "id"
              },
              "op": "count",
              "type": "latest"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [
              {
                "field": {
                  "object": "subscription",
                  "field": "status"
                },
                "operator": "in",
                "value": ["active"]
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.current_period_end",
              "direction": "desc"
            }
          }
        ]
      },
      {
        "id": "subs_churn_retention",
        "label": "Churn & retention",
        "description": "Where and why subscriptions churn.",
        "reports": [
          {
            "id": "subs_churn_rate_over_time",
            "label": "Churn rate",
            "description": "Rate of canceled subscriptions",
            "objects": [
              "subscription"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "created",
                "required": true
              },
              {
                "object": "subscription",
                "field": "canceled_at",
                "required": false
              }
            ],
            "metric": {
              "name": "Churn rate",
              "source": {
                "object": "subscription",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "canceled_subscriptions",
                  "name": "Churn rate",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "subscription",
                        "field": "status"
                      },
                      "operator": "equals",
                      "value": "canceled"
                    }
                  ]
                },
                {
                  "id": "total_subscriptions",
                  "name": "Total subscriptions",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": []
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "canceled_subscriptions",
                "rightOperand": "total_subscriptions",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.created",
              "direction": "desc"
            }
          },
          {
            "id": "subs_churn_by_plan",
            "label": "Churn rate by plan",
            "description": "Churn rate breakdown by product",
            "objects": [
              "subscription",
              "subscription_item",
              "price"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "canceled_at",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "id",
                "required": false
              },
              {
                "object": "subscription_item",
                "field": "subscription_id",
                "required": false
              },
              {
                "object": "price",
                "field": "id",
                "required": true
              },
              {
                "object": "price",
                "field": "nickname",
                "required": true
              }
            ],
            "metric": {
              "name": "Churn rate by plan",
              "source": {
                "object": "subscription",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "subscription",
                  "field": "status"
                },
                "operator": "equals",
                "value": "canceled"
              }
            ],
            "chartType": "bar",
            "defaultSort": {
              "column": "price.nickname",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "price",
                "field": "nickname"
              },
              "selectedValues": []
            }
          },
          {
            "id": "subs_involuntary_churn",
            "label": "Involuntary churn volume",
            "description": "Revenue lost from failed payment subscriptions",
            "objects": [
              "subscription",
              "subscription_item",
              "price"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "canceled_at",
                "required": true
              },
              {
                "object": "subscription",
                "field": "cancellation_details_reason",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "quantity",
                "required": false
              },
              {
                "object": "price",
                "field": "unit_amount",
                "required": true
              },
              {
                "object": "price",
                "field": "currency",
                "required": true
              }
            ],
            "metric": {
              "name": "Involuntary churn volume",
              "source": {
                "object": "price",
                "field": "unit_amount"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [
              {
                "field": {
                  "object": "subscription",
                  "field": "cancellation_details_reason"
                },
                "operator": "equals",
                "value": "payment_failed"
              }
            ],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.canceled_at",
              "direction": "desc"
            }
          }
        ]
      },
      {
        "id": "subs_billing_invoices",
        "label": "Billing & invoices",
        "description": "Invoice lifecycle, aging, and composition.",
        "reports": [
          {
            "id": "subs_invoice_lifecycle_over_time",
            "label": "Invoice volume by status",
            "description": "Invoice amounts broken down by status",
            "objects": [
              "invoice"
            ],
            "fields": [
              {
                "object": "invoice",
                "field": "id",
                "required": true
              },
              {
                "object": "invoice",
                "field": "status",
                "required": true
              },
              {
                "object": "invoice",
                "field": "amount_due",
                "required": true
              },
              {
                "object": "invoice",
                "field": "amount_paid",
                "required": false
              },
              {
                "object": "invoice",
                "field": "due_date",
                "required": false
              },
              {
                "object": "invoice",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Invoice volume by status",
              "source": {
                "object": "invoice",
                "field": "amount_due"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "invoice.created",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "invoice",
                "field": "status"
              },
              "selectedValues": []
            }
          },
          {
            "id": "subs_invoice_time_to_pay",
            "label": "Paid invoice rate",
            "description": "Percentage of invoices successfully paid",
            "objects": [
              "invoice"
            ],
            "fields": [
              {
                "object": "invoice",
                "field": "id",
                "required": true
              },
              {
                "object": "invoice",
                "field": "status",
                "required": true
              },
              {
                "object": "invoice",
                "field": "amount_paid",
                "required": false
              },
              {
                "object": "invoice",
                "field": "paid_at",
                "required": false
              },
              {
                "object": "invoice",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Paid invoice rate",
              "source": {
                "object": "invoice",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "paid_invoices",
                  "name": "Paid invoices",
                  "source": {
                    "object": "invoice",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "invoice",
                        "field": "status"
                      },
                      "operator": "equals",
                      "value": "paid"
                    }
                  ]
                },
                {
                  "id": "total_invoices",
                  "name": "Total invoices",
                  "source": {
                    "object": "invoice",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": []
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "paid_invoices",
                "rightOperand": "total_invoices",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "week"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "invoice.created",
              "direction": "desc"
            }
          },
          {
            "id": "subs_invoice_composition_by_plan",
            "label": "Invoice composition by plan and charges",
            "description": "Invoice breakdown by status and line items",
            "objects": [
              "invoice"
            ],
            "fields": [
              {
                "object": "invoice",
                "field": "id",
                "required": true
              },
              {
                "object": "invoice",
                "field": "amount_due",
                "required": true
              },
              {
                "object": "invoice",
                "field": "amount_paid",
                "required": false
              },
              {
                "object": "invoice",
                "field": "status",
                "required": true
              },
              {
                "object": "invoice",
                "field": "currency",
                "required": true
              },
              {
                "object": "invoice",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Invoice composition by plan and charges",
              "source": {
                "object": "invoice",
                "field": "amount_due"
              },
              "op": "sum",
              "type": "sum_over_period"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "invoice.created",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "invoice",
                "field": "status"
              },
              "selectedValues": []
            }
          }
        ]
      },
      {
        "id": "subs_trials_promotions_upgrades",
        "label": "Trials",
        "description": "Trials, promotions, and plan changes.",
        "reports": [
          {
            "id": "subs_trials_started_converted",
            "label": "Trial conversion rate",
            "description": "Rate of trials that convert to paid subscriptions",
            "objects": [
              "subscription"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription",
                "field": "trial_start",
                "required": false
              },
              {
                "object": "subscription",
                "field": "trial_end",
                "required": false
              },
              {
                "object": "subscription",
                "field": "created",
                "required": true
              }
            ],
            "metric": {
              "name": "Trial conversion rate",
              "source": {
                "object": "subscription",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "converted_trials",
                  "name": "Trial conversion rate",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "subscription",
                        "field": "status"
                      },
                      "operator": "in",
                      "value": [
                        "active",
                        "past_due"
                      ]
                    }
                  ]
                },
                {
                  "id": "all_trials",
                  "name": "All trials",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "subscription",
                        "field": "status"
                      },
                      "operator": "in",
                      "value": [
                        "trialing",
                        "active",
                        "past_due"
                      ]
                    }
                  ]
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "converted_trials",
                "rightOperand": "all_trials",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "line",
            "defaultSort": {
              "column": "subscription.created",
              "direction": "desc"
            }
          },
          {
            "id": "subs_trial_conversion_by_plan",
            "label": "Trial conversion by plan",
            "description": "Trial conversion breakdown by product",
            "objects": [
              "subscription",
              "subscription_item",
              "price"
            ],
            "fields": [
              {
                "object": "subscription",
                "field": "id",
                "required": true
              },
              {
                "object": "subscription",
                "field": "status",
                "required": true
              },
              {
                "object": "subscription_item",
                "field": "id",
                "required": false
              },
              {
                "object": "subscription_item",
                "field": "subscription_id",
                "required": false
              },
              {
                "object": "price",
                "field": "id",
                "required": true
              },
              {
                "object": "price",
                "field": "nickname",
                "required": true
              }
            ],
            "metric": {
              "name": "Trial conversion by plan",
              "source": {
                "object": "subscription",
                "field": "id"
              },
              "op": "count",
              "type": "sum_over_period"
            },
            "multiBlock": {
              "blocks": [
                {
                  "id": "converted_trials_by_plan",
                  "name": "Trial conversion by plan",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "subscription",
                        "field": "status"
                      },
                      "operator": "in",
                      "value": [
                        "active",
                        "past_due"
                      ]
                    }
                  ]
                },
                {
                  "id": "all_trials_by_plan",
                  "name": "All trials",
                  "source": {
                    "object": "subscription",
                    "field": "id"
                  },
                  "op": "count",
                  "type": "sum_over_period",
                  "filters": [
                    {
                      "field": {
                        "object": "subscription",
                        "field": "status"
                      },
                      "operator": "in",
                      "value": [
                        "trialing",
                        "active",
                        "past_due"
                      ]
                    }
                  ]
                }
              ],
              "calculation": {
                "operator": "divide",
                "leftOperand": "converted_trials_by_plan",
                "rightOperand": "all_trials_by_plan",
                "resultUnitType": "percentage"
              },
              "outputUnit": "rate"
            },
            "range": {
              "start": "YTD",
              "end": "today",
              "granularity": "month"
            },
            "filters": [],
            "chartType": "bar",
            "defaultSort": {
              "column": "price.nickname",
              "direction": "desc"
            },
            "groupBy": {
              "field": {
                "object": "price",
                "field": "nickname"
              },
              "selectedValues": []
            }
          }
        ]
      }
    ]
  }
];
