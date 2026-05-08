import { describe, it, expect } from 'vitest';
// AUTH-01, AUTH-02. Wired in Plan 04 (frontend Signup) + Plan 05 (manual checkpoint).
describe('AUTH-01 signup', () => {
  it.skip('supabase.auth.signUp creates a user with email+password', async () => {
    expect(true).toBe(true);
  });
});
describe('AUTH-02 email verification', () => {
  it.skip('signup triggers verification email with redirect to /auth/callback', async () => {
    expect(true).toBe(true);
  });
});
