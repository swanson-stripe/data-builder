import { faker } from '@faker-js/faker';
import {
  stripeId,
  randomDate,
  pickRandom,
  maybe,
  toISODate,
  CURRENCIES,
  COUNTRIES,
  logProgress,
} from './base.mjs';

/**
 * Generate customer records
 */
export function generateCustomers(count = 1000) {
  logProgress(`Generating ${count} customers...`);
  
  const customers = [];

  for (let i = 0; i < count; i++) {
    const createdDate = randomDate(0.9); // 90% in 2025
    const currency = pickRandom(CURRENCIES);
    const country = pickRandom(COUNTRIES);
    
    // Generate billing address (70% of customers)
    const hasBillingAddress = Math.random() < 0.7;
    const billingAddress = hasBillingAddress ? {
      address_city: faker.location.city(),
      address_country: country,
      address_line1: faker.location.streetAddress(),
      address_line2: maybe(faker.location.secondaryAddress(), 0.3),
      address_postal_code: faker.location.zipCode(),
      address_state: faker.location.state(),
    } : {
      address_city: null,
      address_country: null,
      address_line1: null,
      address_line2: null,
      address_postal_code: null,
      address_state: null,
    };

    // Generate shipping address (40% of customers)
    const hasShippingAddress = Math.random() < 0.4;
    const shippingAddress = hasShippingAddress ? {
      shipping_address_city: faker.location.city(),
      shipping_address_country: country,
      shipping_address_line1: faker.location.streetAddress(),
      shipping_address_line2: maybe(faker.location.secondaryAddress(), 0.3),
      shipping_address_postal_code: faker.location.zipCode(),
      shipping_address_state: faker.location.state(),
      shipping_name: faker.person.fullName(),
      shipping_phone: maybe(faker.phone.number(), 0.8),
    } : {
      shipping_address_city: null,
      shipping_address_country: null,
      shipping_address_line1: null,
      shipping_address_line2: null,
      shipping_address_postal_code: null,
      shipping_address_state: null,
      shipping_name: null,
      shipping_phone: null,
    };

    // Balance: mostly 0, some positive (credit), some negative (debt)
    let balance = 0;
    const balanceRoll = Math.random();
    if (balanceRoll < 0.05) {
      balance = -Math.floor(Math.random() * 10000); // Negative = credit
    } else if (balanceRoll < 0.1) {
      balance = Math.floor(Math.random() * 5000); // Positive = debt
    }

    customers.push({
      id: stripeId('cus'),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      phone: maybe(faker.phone.number(), 0.6),
      description: maybe(faker.company.catchPhrase(), 0.3),
      created: toISODate(createdDate),
      balance,
      delinquent: balance > 0 && Math.random() < 0.15, // 15% of customers with debt are delinquent
      currency,
      default_source_id: null, // Will be populated after payment methods are generated
      invoice_settings_default_payment_method_id: null, // Will be populated after payment methods are generated
      ...billingAddress,
      ...shippingAddress,
      tax_exempt: pickRandom(['none', 'none', 'none', 'exempt', 'reverse']), // Mostly 'none'
      preferred_locales: maybe(['en', 'en-US', 'en-GB', 'fr', 'de', 'es'][Math.floor(Math.random() * 6)], 0.4),
    });
  }

  logProgress(`✓ Generated ${customers.length} customers`);
  return customers;
}

