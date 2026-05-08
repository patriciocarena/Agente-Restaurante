import { describe, it, expect } from 'vitest';
// AUTH-05: Tenant isolation. Wired in Plan 02 once the schema + RLS exist.
describe('AUTH-05 RLS tenant isolation', () => {
  it.skip('tenant A cannot SELECT tenant B rows from restaurants', async () => {
    expect(true).toBe(true);
  });
  it.skip('tenant A cannot SELECT tenant B rows from menu_items', async () => {
    expect(true).toBe(true);
  });
  it.skip('tenant A cannot SELECT tenant B rows from option_groups (RLS via JOIN)', async () => {
    expect(true).toBe(true);
  });
});
