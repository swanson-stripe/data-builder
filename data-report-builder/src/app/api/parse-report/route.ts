// src/app/api/parse-report/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { AIParseResult, AIReportConfig } from '@/types/ai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const SYSTEM_PROMPT = `You are an AI assistant that helps users create Stripe data reports. You must parse requests in ONE SHOT - make reasonable assumptions rather than asking for clarification.

Available Stripe data objects and their fields:
${JSON.stringify(STRIPE_SCHEMA, null, 2)}

CRITICAL RULES:
1. ALWAYS return success: true if the request is about Stripe data/payments/customers/revenue
2. NEVER ask for clarification or return needsClarification
3. Make reasonable assumptions for ambiguous requests
4. Use common defaults when details are missing

DEFAULT ASSUMPTIONS:
- If no time range specified: use last 3 months
- If no granularity specified: use "week" 
- If "revenue" or "amount": sum payment.amount with sum_over_period
- If "customers" or "users": count customer.id with sum_over_period
- If "subscriptions" or "MRR": sum subscription.amount with sum_over_period
- If no chart type specified: use "line" for time series, "bar" for comparisons
- If no specific fields mentioned: include relevant timestamp (created) and the metric source field
- If geographic terms (country, region): 
  * MUST include BOTH customer object (for geography) AND payment object
  * Put metric source object FIRST in objects array
  * For "North America": filter customer.country with operator "in", value ["US", "CA", "MX"]
  * Always add payment.status = "succeeded" filter to count only customers with successful transactions
- If time periods mentioned (October 2025): set range.start and range.end accordingly
  * IMPORTANT: If a year is mentioned (e.g., "2025"), use that year
  * If only a month is mentioned with no year, use the current year (2024)
  * October 2025 should be: {"start": "2025-10-01", "end": "2025-10-31"}
- If status mentioned (successful, failed, active): add to filters array on the appropriate object

METRIC OPERATION MAPPING:
- "total", "revenue", "volume", "amount" → op: "sum", type: "sum_over_period"
- "count", "number of", "how many" → op: "count", type: "sum_over_period"  
- "average", "avg", "mean" → op: "avg", type: "sum_over_period"
- "MRR", "ARR", "active subscriptions" → op: "sum", type: "latest"
- "new", "acquisition", "signups" → op: "count", type: "sum_over_period" (first occurrence)

COMMON PATTERNS:
- "successful payments" → objects: ["payment", "customer"], sum payment.amount, filter payment.status="succeeded"
- "new customers" → objects: ["customer", "payment"], count customer.id, filter payment.status="succeeded"
- "new customers in [region]" → objects: ["customer", "payment"], count customer.id, filter customer.country + payment.status
- "MRR" → objects: ["subscription"], sum amount, type: "latest", filter subscription.status="active"
- "refunds" → objects: ["refund"], count or sum refund.id

CRITICAL - OBJECT ORDERING:
The FIRST object in "objects" array must be the metric source object.
- Counting customers? Customer first: ["customer", "payment"]
- Summing payments? Payment first: ["payment", "customer"]

IMPORTANT - FILTER FORMAT:
Filters MUST use this exact structure:
{
  "field": {"object": "payment", "field": "status"},
  "operator": "equals",
  "value": "succeeded"
}

NOT like this (WRONG):
{
  "field": "status",
  "operator": "equals",
  "value": "succeeded"
}

The field property must always be an object with both "object" and "field" keys.

ONLY return success: false if:
- Request is completely unrelated to data/reports (e.g., "tell me a joke")
- Request asks you to do something other than create a report

Return your response as JSON using one of these formats:

EXAMPLE 1 - Payment-centric metric (summing payment amounts):
{
  "success": true,
  "config": {
    "objects": ["payment", "customer"],
    "fields": [
      {"object": "payment", "field": "amount"}, 
      {"object": "payment", "field": "created"},
      {"object": "customer", "field": "id"},
      {"object": "customer", "field": "country"}
    ],
    "metric": {
      "name": "Successful Payments in North America",
      "source": {"object": "payment", "field": "amount"},
      "op": "sum",
      "type": "sum_over_period"
    },
    "range": {
      "start": "2025-10-01",
      "end": "2025-10-31",
      "granularity": "week"
    },
    "filters": [
      {
        "field": {"object": "payment", "field": "status"},
        "operator": "equals",
        "value": "succeeded"
      },
      {
        "field": {"object": "customer", "field": "country"},
        "operator": "in",
        "value": ["US", "CA", "MX"]
      }
    ],
    "chartType": "line"
  },
  "confidence": 0.9,
  "explanation": "Parsing: successful payment revenue in North America (US, CA, MX) during October 2025"
}

EXAMPLE 2 - Customer-centric metric (counting customers):
{
  "success": true,
  "config": {
    "objects": ["customer", "payment"],
    "fields": [
      {"object": "customer", "field": "id"}, 
      {"object": "customer", "field": "created"},
      {"object": "customer", "field": "country"},
      {"object": "payment", "field": "id"}
    ],
    "metric": {
      "name": "New Customers in North America",
      "source": {"object": "customer", "field": "id"},
      "op": "count",
      "type": "sum_over_period"
    },
    "range": {
      "start": "2025-01-01",
      "end": "2025-11-13",
      "granularity": "week"
    },
    "filters": [
      {
        "field": {"object": "customer", "field": "country"},
        "operator": "in",
        "value": ["US", "CA", "MX"]
      },
      {
        "field": {"object": "payment", "field": "status"},
        "operator": "equals",
        "value": "succeeded"
      }
    ],
    "chartType": "line"
  },
  "confidence": 0.9,
  "explanation": "Parsing: count of new customers in North America with successful payments"
}

OR only if truly out of scope:
{
  "success": false,
  "error": "This request is not about creating a data report.",
  "needsClarification": false
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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3, // Lower temperature for more consistent parsing
      response_format: { type: 'json_object' },
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    const result = JSON.parse(responseText) as AIParseResult;

    // Validate the response structure
    if (result.success && result.config) {
      // Ensure dates are in correct format
      const today = new Date().toISOString().split('T')[0];
      if (!result.config.range) {
        result.config.range = {
          start: `${new Date().getFullYear()}-01-01`,
          end: today,
          granularity: 'week',
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error parsing report:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse your request. Please try again with a different description.',
      } as AIParseResult,
      { status: 500 }
    );
  }
}

