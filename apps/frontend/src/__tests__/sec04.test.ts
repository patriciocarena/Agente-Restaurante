import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
// SEC-04: service role key must not appear in built frontend bundle
describe('SEC-04 service role key bundle leak', () => {
  it('check-sec04.sh exits 0 when dist/ has no service role references', () => {
    // Ensure dist exists (empty) so script can run before build
    const root = process.cwd();
    const distDir = `${root}/dist`;
    if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
    const exit = (() => {
      try {
        // Quote the path to handle spaces in directory names
        execSync(`bash "${root}/../../scripts/check-sec04.sh"`, { stdio: 'pipe' });
        return 0;
      } catch (e: any) {
        return e.status ?? 1;
      }
    })();
    expect(exit).toBe(0);
  });
});
