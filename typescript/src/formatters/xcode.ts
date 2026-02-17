/**
 * Xcode formatter for native issue navigator warnings
 */
import type { ScanResult } from '../types/index.js';

interface ParsedLocation {
  filePath?: string;
  line?: number;
  column?: number;
}

function parseLocation(location?: string): ParsedLocation {
  if (!location) {
    return {};
  }

  const withLineCol = location.match(/^(.*):(\d+):(\d+)$/);
  if (withLineCol) {
    return {
      filePath: withLineCol[1],
      line: Number.parseInt(withLineCol[2], 10),
      column: Number.parseInt(withLineCol[3], 10),
    };
  }

  const withLine = location.match(/^(.*):(\d+)$/);
  if (withLine) {
    return {
      filePath: withLine[1],
      line: Number.parseInt(withLine[2], 10),
      column: 1,
    };
  }

  return { filePath: location };
}

/**
 * Format scan results as Xcode-compatible warnings
 */
export function formatXcode(result: ScanResult): string {
  return result.findings
    .map((finding) => {
      const parsed = parseLocation(finding.location);
      const file = parsed.filePath ?? result.projectPath;
      const line = parsed.line ?? 1;
      const col = parsed.column ?? 1;
      const message = finding.title.replace(/\s+/g, ' ').trim();

      return `${file}:${line}:${col}: warning: ${message} (${finding.ruleId})`;
    })
    .join('\n');
}
