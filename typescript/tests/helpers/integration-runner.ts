/**
 * Integration test runner utilities.
 *
 * Handles temp directory lifecycle and provides a clean interface for
 * running ShipLint's scanner against real fixture projects.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scan } from '../../src/core/scanner.js';
import type { ScanResult, ScanOptions, Finding } from '../../src/types/index.js';

/**
 * Create a temporary directory for a test fixture.
 */
export function createTempDir(prefix: string = 'shiplint-integration-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Recursively remove a directory (cleanup).
 */
export function removeTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Run ShipLint scan against a project path.
 * Thin wrapper around the real scanner — no mocks.
 */
export async function runScan(
  projectPath: string,
  options: Partial<ScanOptions> = {},
): Promise<ScanResult> {
  return scan({
    path: projectPath,
    ...options,
  });
}

/**
 * Assert helpers for findings.
 */
export function findingsByRule(result: ScanResult, ruleId: string): Finding[] {
  return result.findings.filter((f) => f.ruleId === ruleId);
}

export function hasFinding(result: ScanResult, ruleId: string): boolean {
  return findingsByRule(result, ruleId).length > 0;
}

export function hasNoFinding(result: ScanResult, ruleId: string): boolean {
  return findingsByRule(result, ruleId).length === 0;
}

/**
 * Convenience: create temp dir, run callback, clean up.
 * Always cleans up even if the callback throws.
 */
export async function withFixture<T>(
  fn: (tmpDir: string) => Promise<T>,
): Promise<T> {
  const tmpDir = createTempDir();
  try {
    return await fn(tmpDir);
  } finally {
    removeTempDir(tmpDir);
  }
}
