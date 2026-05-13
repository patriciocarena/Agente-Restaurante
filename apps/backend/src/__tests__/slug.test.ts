import { describe, it, expect } from 'vitest';

describe('generateUniqueSlug', () => {
  it.skip('generates a slug from a name (lowercase, trim spaces)', async () => {
    // Wired in Plan 02-02 — basic slug generation
    expect(true).toBe(true);
  });

  it.skip('replaces accented characters (é -> e, ñ -> n, etc.)', async () => {
    // Wired in Plan 02-02 — accent normalization for Argentine names
    expect(true).toBe(true);
  });

  it.skip('appends -1, -2 suffix when slug collides with existing slug', async () => {
    // Wired in Plan 02-02 — collision detection + suffix logic
    expect(true).toBe(true);
  });

  it.skip('handles ñ (eñe) properly in Spanish names (e.g., "La Piñata" -> "la-pinata")', async () => {
    // Wired in Plan 02-02 — Spanish character handling
    expect(true).toBe(true);
  });
});
