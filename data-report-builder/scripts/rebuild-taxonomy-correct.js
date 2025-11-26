const fs = require('fs');
const path = require('path');

// The CORRECT 3-level hierarchy based on the user's feedback:
// Level 1: Category (chips) → Level 2: Topic (chips) → Level 3: Reports (carousel)
//
// What the user showed:
// "Invoice status over time" (this is actually a TOPIC level)
//   ↓ these should be in the CAROUSEL as separate report templates:
// "Invoice status over time by day"
// "Invoice status over time by status"

// Based on the original JSON provided, the structure is:
// Category.topics[] → Topic (has subTopics)
//   Topic.subTopics[] → SubTopic (has reports with dimensions)
//     SubTopic.reports[] → Report definitions
//       Report.dimensions[] → Different breakdowns
//
// The user wants us to COLLAPSE this so that:
// - Category stays as chips (Level 1)
// - SubTopics become Topics as chips (Level 2)  ← This is the key insight
// - Each dimension creates a SEPARATE report for the carousel (Level 3)

const categories = [
  {
    "id": "subscriptions_invoicing",
    "label": "Subscriptions & Invoicing",
    "description": "Track recurring revenue, churn, and invoice health.",
    "topics": [
      {
        "id": "invoices_health",
        "label": "Invoices & billing health",
        "description": "Monitor invoice states, overdue amounts, and collections.",
        "reports": [
          {
            "id": "invoice_status_over_time_by_day",
            "label": "Invoice status over time by day",
            "description": "Issued, paid, and overdue invoices by day.",
            "base_tables": [],
            "time_column": "inv.created",
            "metrics": [],
            "dimensions": [],
            "default_dimension": "by_day",
            "required_filters": [],
            "optional_filters": [],
          },
          {
            "id": "invoice_status_over_time_by_status",
            "label": "Invoice status over time by status",
            "description": "Issued, paid, and overdue invoices by status.",
            "base_tables": [],
            "time_column": "inv.created",
            "metrics": [],
            "dimensions": [],
            "default_dimension": "by_status",
            "required_filters": [],
            "optional_filters": [],
          }
        ]
      }
    ]
  }
];

console.log('✅ Manual taxonomy structure created');
console.log('This demonstrates the CORRECT 3-level structure:');
console.log('  Categories:', categories.length);
console.log('  Example Topic:', categories[0].topics[0].label);
console.log('  Example Reports under that topic:', categories[0].topics[0].reports.map(r => r.label));
console.log('\nThe user wants:');
console.log('  1. Category chips (Subscriptions & Invoicing)');
console.log('  2. Topic chips (Invoices & billing health)');
console.log('  3. Reports in CAROUSEL (Invoice status over time by day, by status, etc.)');

