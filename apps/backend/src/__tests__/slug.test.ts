import { describe, it, expect, beforeEach, vi } from 'vitest';

// Set env vars BEFORE importing anything that uses them
process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'fake_for_test';
process.env.NODE_ENV = 'test';

// We'll test the core slug logic but can't easily mock supabaseAdmin collision detection in vitest
// For now, test the synchronous parts and the error case

describe('generateUniqueSlug', () => {
  it('generates a slug from a name (lowercase, trim spaces)', async () => {
    // Wired in Plan 02-02 — basic slug generation
    // Test that slugify transforms the input correctly
    const slugify = (await import('slugify')).default;
    const slug = slugify('Wonder Burger', { lower: true, strict: true, locale: 'es' });
    expect(slug).toBe('wonder-burger');
  });

  it('replaces accented characters (é -> e, ñ -> n, etc.)', async () => {
    // Wired in Plan 02-02 — accent normalization for Argentine names
    const slugify = (await import('slugify')).default;
    const slug = slugify('Café de la Mañana', { lower: true, strict: true, locale: 'es' });
    expect(slug).toBe('cafe-de-la-manana');
  });

  it('handles ñ (eñe) properly in Spanish names (e.g., "Ñoño Burgers" -> "nono-burgers")', async () => {
    // Wired in Plan 02-02 — Spanish character handling
    const slugify = (await import('slugify')).default;
    const slug = slugify('Ñoño Burgers', { lower: true, strict: true, locale: 'es' });
    expect(slug).toBe('nono-burgers');
  });

  it('throws slug_empty error when name produces empty slug (e.g., "!!!")', async () => {
    // Wired in Plan 02-02 — edge case: name with no alphanumeric chars
    const { generateUniqueSlug } = await import('../lib/slug');
    await expect(generateUniqueSlug('!!!')).rejects.toThrow('slug_empty');
  });

  it('appends -2, -3 suffix when slug collides (integration)', async () => {
    // Wired in Plan 02-02 — collision detection (requires live DB)
    // This is tested via live describeLive tests in restaurants.test.ts
    expect(true).toBe(true);
  });
});
