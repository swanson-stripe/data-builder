const fs = require('fs');
const path = require('path');

// The new 4-level JSON provided by the user
const newTaxonomy = {
  "version": "1.0",
  "note": "Stripe Sigma exploration tree with four levels: category -> topic -> subtopic -> report. Table/column names follow Stripe Data public schema; adjust as needed.",
  "top_categories": [
    {
      "id": "payments",
      "label": "Payments",
      "description": "Understand payment performance, volume, refunds, and economics.",
      "topics": [
        {
          "id": "payments_performance_conversion",
          "label": "Performance & conversion",
          "description": "Are my customers able to pay successfully? Where do payments fail?",
          "subtopics": [
            {
              "id": "payments_acceptance_overview_st",
              "label": "Acceptance overview",
              "description": "Overall authorization and acceptance",
              "reports": [
                {
                  "id": "payments_acceptance_overview",
                  "label": "Payment acceptance overview",
                  "description": "Overall payment success vs failure",
                  // ... (will include full structure in actual implementation)
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

// Note: The actual full JSON will be pasted in below
console.log('Script ready - paste full JSON structure here');

