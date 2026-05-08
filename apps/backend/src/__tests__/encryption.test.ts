import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
// SEC-05: customer_phone never appears in console.log patterns inside backend src
describe('SEC-05 customer_phone no-log policy', () => {
  it('source code has no console.log calls referencing customer_phone', () => {
    let out = '';
    try {
      // grep -RnE: regex; -- excludes binary; src only
      out = execSync(
        "grep -RnE 'console\\.(log|info|warn|error)\\([^)]*customer_phone' apps/backend/src || true",
        { encoding: 'utf8', cwd: process.cwd().replace(/apps\/backend$/, '') }
      );
    } catch (e) {
      out = '';
    }
    // Allow occurrences inside test files only (this file is a test, not src code matching)
    const offending = out
      .split('\n')
      .filter(line => line && !line.includes('__tests__/') && !line.includes('.test.'));
    expect(offending).toEqual([]);
  });
});
