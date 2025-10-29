/**
 * Test warehouse validation
 */
import { validateWarehouse } from '../validate';

describe('Warehouse Validation', () => {
  test('warehouse has valid FK integrity', () => {
    const result = validateWarehouse();

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
