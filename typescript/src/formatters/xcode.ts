/**
 * Xcode formatter for native warning presentation in Xcode build logs
 * Format: file:line:col: warning: message (rule_id)
 */
import type { ScanResult } from '../types/index.js';

function sanitizeLocation(location: string): string {
  return location.replace(/\r?\n/g, ' ').trim();
}

export function formatXcode(result: ScanResult): string {
  if (result.findings.length === 0) {
    return '';
  }

  return result.findings
    .map((finding) => {
      const file = sanitizeLocation(finding.location ?? result.projectPath);
      const line = finding.line ?? 1;
      const column = 1;
      const message = finding.title.replace(/\r?\n/g, ' ').trim();
      return `${file}:${line}:${column}: warning: ${message} (${finding.ruleId})`;
    })
    .join('\n');
}
