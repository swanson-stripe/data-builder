import { faker } from '@faker-js/faker';
import {
  stripeId,
  dateAfter,
  pickRandom,
  toISODate,
  logProgress,
} from './base.mjs';

/**
 * Generate customer tax ID records (~30% of customers)
 */
export function generateCustomerTaxIds(customers) {
  logProgress(`Generating customer tax IDs...`);
  
  const taxIds = [];

  // Generate tax IDs for ~30% of customers
  const customersWithTaxIds = customers.filter(() => Math.random() < 0.3);

  for (const customer of customersWithTaxIds) {
    const createdDate = dateAfter(new Date(customer.created), Math.floor(Math.random() * 10));

    // Tax ID type distribution based on country
    const country = customer.address_country || pickRandom(['US', 'GB', 'DE', 'FR', 'CA']);
    
    let type;
    let value;
    
    switch (country) {
      case 'US':
        type = 'us_ein';
        value = `${faker.string.numeric(2)}-${faker.string.numeric(7)}`; // XX-XXXXXXX
        break;
      case 'GB':
        type = 'gb_vat';
        value = `GB${faker.string.numeric(9)}`; // GBXXXXXXXXX
        break;
      case 'DE':
      case 'FR':
      case 'ES':
      case 'IT':
      case 'NL':
        type = 'eu_vat';
        value = `${country}${faker.string.numeric(9)}`; // CCXXXXXXXXX
        break;
      case 'CA':
        type = 'ca_bn';
        value = faker.string.numeric(9);
        break;
      case 'AU':
        type = 'au_abn';
        value = faker.string.numeric(11);
        break;
      case 'IN':
        type = 'in_gst';
        value = `${faker.string.numeric(2)}${faker.string.alphanumeric({ length: 10, casing: 'upper' })}${faker.string.numeric(3)}`;
        break;
      case 'JP':
        type = pickRandom(['jp_cn', 'jp_rn']);
        value = faker.string.numeric(13);
        break;
      case 'BR':
        type = pickRandom(['br_cnpj', 'br_cpf']);
        value = type === 'br_cnpj' ? faker.string.numeric(14) : faker.string.numeric(11);
        break;
      default:
        type = 'eu_vat';
        value = `${country}${faker.string.numeric(9)}`;
    }

    // Verification status distribution
    const verificationStatus = pickRandom([
      'verified',
      'verified',
      'verified',
      'pending',
      'unverified',
      'unavailable',
    ]);

    taxIds.push({
      id: stripeId('txi'),
      customer_id: customer.id,
      type,
      value,
      created: toISODate(createdDate),
      verification_status: verificationStatus,
    });
  }

  logProgress(`✓ Generated ${taxIds.length} customer tax IDs`);
  return taxIds;
}

