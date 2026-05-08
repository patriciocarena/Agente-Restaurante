import { describe, it, expect, vi } from 'vitest';
import { logger, redactPII } from '../lib/logger';

describe('redactPII', () => {
  it('replaces customer_phone with [REDACTED]', () => {
    const out = redactPII({ customer_phone: '+541112345', name: 'Pat' });
    expect((out as any).customer_phone).toBe('[REDACTED]');
    expect((out as any).name).toBe('Pat');
  });

  it('redacts deep nested customer_phone', () => {
    const out = redactPII({ order: { customer_phone: '+5411', items: [] } });
    expect((out as any).order.customer_phone).toBe('[REDACTED]');
  });

  it('redacts inside arrays', () => {
    const out = redactPII([{ customer_phone: 'X' }]);
    expect((out as any)[0].customer_phone).toBe('[REDACTED]');
  });
});

describe('logger emits redacted JSON', () => {
  it('logger.info({customer_phone}) writes [REDACTED] to stdout', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('order received', { customer_phone: '+541199' });
    expect(spy).toHaveBeenCalledOnce();
    const written = (spy.mock.calls[0]?.[0] as string) ?? '';
    expect(written).toContain('[REDACTED]');
    expect(written).not.toContain('+541199');
    spy.mockRestore();
  });
});
