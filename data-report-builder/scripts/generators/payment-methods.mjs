import { faker } from '@faker-js/faker';
import {
  stripeId,
  dateAfter,
  pickRandom,
  toISODate,
  CARD_BRANDS,
  logProgress,
} from './base.mjs';

/**
 * Generate payment method records for customers
 */
export function generatePaymentMethods(customers) {
  logProgress(`Generating payment methods for ${customers.length} customers...`);
  
  const methods = [];

  for (const customer of customers) {
    // 80% of customers have payment methods, 20% don't
    if (Math.random() > 0.8) continue;

    // Most customers have 1 payment method, some have 2-3
    const methodCount = Math.random() < 0.85 ? 1 : (Math.random() < 0.8 ? 2 : 3);

    for (let i = 0; i < methodCount; i++) {
      const createdDate = dateAfter(new Date(customer.created), Math.floor(Math.random() * 30));
      
      // Type distribution: mostly cards, some bank accounts
      const type = pickRandom(['card', 'card', 'card', 'card', 'bank_account', 'sepa_debit', 'us_bank_account']);
      
      // Card-specific fields
      let cardBrand = null;
      let cardLast4 = null;
      let cardExpMonth = null;
      let cardExpYear = null;
      
      if (type === 'card') {
        cardBrand = pickRandom(CARD_BRANDS);
        cardLast4 = faker.string.numeric({ length: 4 });
        cardExpMonth = faker.number.int({ min: 1, max: 12 });
        // Exp year: 50% current/future, 50% past (for testing expired cards)
        const currentYear = new Date().getFullYear();
        if (Math.random() < 0.5) {
          cardExpYear = currentYear + faker.number.int({ min: 0, max: 5 });
        } else {
          cardExpYear = currentYear + faker.number.int({ min: -2, max: 10 });
        }
      }

      methods.push({
        id: stripeId('pm'),
        customer_id: customer.id,
        type,
        card_brand: cardBrand,
        card_last4: cardLast4,
        card_exp_month: cardExpMonth,
        card_exp_year: cardExpYear,
        created: toISODate(createdDate),
      });
    }
  }

  logProgress(`✓ Generated ${methods.length} payment methods`);
  return methods;
}

/**
 * Link payment methods back to customers (update default_payment_method_id)
 */
export function linkPaymentMethodsToCustomers(customers, paymentMethods) {
  logProgress('Linking payment methods to customers...');
  
  // Create index of payment methods by customer_id
  const methodsByCustomer = {};
  for (const method of paymentMethods) {
    if (!methodsByCustomer[method.customer_id]) {
      methodsByCustomer[method.customer_id] = [];
    }
    methodsByCustomer[method.customer_id].push(method);
  }

  // Update customer records
  let linkedCount = 0;
  for (const customer of customers) {
    const customerMethods = methodsByCustomer[customer.id];
    if (customerMethods && customerMethods.length > 0) {
      // Set first payment method as default
      customer.invoice_settings_default_payment_method_id = customerMethods[0].id;
      customer.default_source_id = customerMethods[0].id;
      linkedCount++;
    }
  }

  logProgress(`✓ Linked ${linkedCount} customers to payment methods`);
}

