// src/app/api/parse-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AIParseResult, AIReportConfig } from '@/types/ai';

// Initialize OpenAI client lazily to avoid build-time errors
let openaiClient: OpenAI | null = null;
function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Available data objects and their fields for context
const STRIPE_SCHEMA = {
  payment: ['id', 'customer_id', 'payment_method_id', 'product_id', 'amount', 'currency', 'created', 'status', 'captured'],
  charge: ['id', 'customer_id', 'amount', 'currency', 'created', 'status', 'description'],
  customer: ['id', 'email', 'name', 'country', 'created', 'balance', 'delinquent'],
  subscription: ['id', 'customer_id', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'created', 'currency'],
  subscription_item: ['id', 'subscription_id', 'price_id', 'quantity', 'created'],
  invoice: ['id', 'customer_id', 'subscription_id', 'amount_paid', 'amount_due', 'status', 'created', 'currency'],
  refund: ['id', 'payment_id', 'amount', 'status', 'reason', 'created', 'currency'],
  price: ['id', 'product_id', 'unit_amount', 'currency', 'recurring_interval', 'active'],
  product: ['id', 'name', 'description', 'active', 'created'],
  payment_method: ['id', 'customer_id', 'type', 'card_brand', 'card_last4'],
};

const SYSTEM_PROMPT = `You are an AI assistant that helps users create Stripe data reports. Parse requests and return valid JSON.

Available Stripe data objects and their fields:
${JSON.stringify(STRIPE_SCHEMA, null, 2)}

RULES:
1. Return success: true if request is about Stripe data/payments/customers/revenue
2. Make reasonable assumptions for missing details
3. For rate/percentage metrics, use multiBlock format with two blocks and divide operator

DEFAULTS:
- Time range: Use current year if year mentioned, otherwise last 1 month (4 weeks)
- Granularity: "week"
- Chart type: "line"
- Filters: Include relevant status filters (e.g., payment.status for payment metrics)

RATE METRICS:
For "rate", "percentage", or "ratio" requests, use multiBlock with:
- Block 1 (numerator): Count/sum with specific filter, type: "latest"
- Block 2 (denominator): Count/sum of total, type: "latest"
- Calculation: divide, resultUnitType: "rate"

Example: "blocked payment rate"
- Block 1: count payment.id where status in ["failed", "blocked"], type: "latest"
- Block 2: count payment.id (all payments), type: "latest"
- divide block_1 / block_2

FILTER FORMAT:
{
  "field": {"object": "payment", "field": "status"},
  "operator": "equals",
  "value": "succeeded"
}

Return JSON in one of these formats:

SIMPLE METRIC (count/sum):
{
  "success": true,
  "config": {
    "objects": ["payment"],
    "fields": [
      {"object": "payment", "field": "id"},
      {"object": "payment", "field": "amount"},
      {"object": "payment", "field": "created"}
    ],
    "metric": {
      "name": "Payment Volume",
      "source": {"object": "payment", "field": "amount"},
      "op": "sum",
      "type": "sum_over_period"
    },
    "range": {
      "start": "2025-01-01",
      "end": "2025-11-13",
      "granularity": "week"
    },
    "filters": [],
    "chartType": "line"
  }
}

RATE METRIC (use multiBlock):
{
  "success": true,
  "config": {
    "objects": ["payment"],
    "fields": [
      {"object": "payment", "field": "id"},
      {"object": "payment", "field": "status"},
      {"object": "payment", "field": "created"}
    ],
    "multiBlock": {
      "blocks": [
        {
          "id": "block_1",
          "name": "Blocked Payments",
          "source": {"object": "payment", "field": "id"},
          "op": "count",
          "type": "latest",
          "filters": [
            {
              "field": {"object": "payment", "field": "status"},
              "operator": "in",
              "value": ["failed", "blocked"]
            }
          ]
        },
        {
          "id": "block_2",
          "name": "Total Payments",
          "source": {"object": "payment", "field": "id"},
          "op": "count",
          "type": "latest",
          "filters": []
        }
      ],
      "calculation": {
        "operator": "divide",
        "leftOperand": "block_1",
        "rightOperand": "block_2",
        "resultUnitType": "rate"
      },
      "outputUnit": "rate"
    },
    "range": {
      "start": "2025-01-01",
      "end": "2025-11-13",
      "granularity": "week"
    },
    "chartType": "line"
  }
}`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a prompt describing the report you want to create.',
        } as AIParseResult,
        { status: 400 }
      );
    }

    // Get OpenAI client
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env.local',
        } as AIParseResult,
        { status: 500 }
      );
    }

    // Call OpenAI API
    let responseText: string;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      responseText = completion.choices[0]?.message?.content || '';
      if (!responseText) {
        throw new Error('No response from AI');
      }
    } catch (apiError: any) {
      console.error('🤖 [API] OpenAI API error:', apiError.message);
      console.error('🤖 [API] Error details:', apiError);
      
      // Check if it's an API key issue
      if (apiError.message?.includes('API key') || apiError.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to .env.local',
          } as AIParseResult,
          { status: 500 }
        );
      }
      
      throw apiError;
    }

    // Log the raw response for debugging
    console.log('🤖 [API] Raw AI response:', responseText);

    // Parse the JSON response
    let result: AIParseResult;
    try {
      result = JSON.parse(responseText) as AIParseResult;
      console.log('🤖 [API] Parsed result:', JSON.stringify(result, null, 2));
    } catch (parseError) {
      console.error('🤖 [API] JSON parse error:', parseError);
      console.error('🤖 [API] Invalid JSON:', responseText);
      throw new Error('AI returned invalid JSON');
    }

    // Validate the response structure
    if (result.success && result.config) {
      // Ensure dates are in correct format
      const today = new Date();
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      if (!result.config.range) {
        result.config.range = {
          start: oneMonthAgo.toISOString().split('T')[0],
          end: today.toISOString().split('T')[0],
          granularity: 'week',
        };
      }
    }

    console.log('🤖 [API] Returning result:', result.success);
    return NextResponse.json(result);
  } catch (error) {
    console.error('🤖 [API] Error parsing report:', error);
    console.error('🤖 [API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse your request. Please try again with a different description.',
      } as AIParseResult,
      { status: 500 }
    );
  }
}

