import { describe, it, expect } from 'vitest';

describe('Onboarding wizard (ONB-01..03, ONB-06)', () => {
  it.skip('Step 1 validation blocks advance with empty name', async () => {
    // Wired in Plan 02-05 — form validation + error display
    expect(true).toBe(true);
  });

  it.skip('Step 2 maps Lun..Dom UI order to ISO day_of_week (0=Sun) for storage', async () => {
    // Wired in Plan 02-05 — day order mapping (UI shows Mon-Sun, DB stores ISO 0-6)
    expect(true).toBe(true);
  });

  it.skip('Step 4 default agent_name is "Sofía" when not set', async () => {
    // Wired in Plan 02-05 — default value in form
    expect(true).toBe(true);
  });
});
