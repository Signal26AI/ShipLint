/**
 * Text formatter for human-readable output
 * v3: clean, width-aware CLI diagnostics
 */
import * as path from 'path';
import type { ScanResult, Finding } from '../types/index.js';
import { Severity } from '../types/index.js';

// Dynamic import for chalk (ESM)
let chalk: typeof import('chalk').default;

async function getChalk() {
  if (!chalk) {
    const module = await import('chalk');
    chalk = module.default;
  }
  return chalk;
}

/**
 * Severity sort order
 */
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function getTerminalWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

function separator(char: string, width: number): string {
  return char.repeat(width);
}

function displayPath(projectPath: string, location: string): string {
  if (!path.isAbsolute(location)) {
    return location;
  }

  const relative = path.relative(projectPath, location);
  if (!relative.startsWith('..') && relative !== '') {
    return relative;
  }

  return location;
}

function inferCheckedFileCount(result: ScanResult): number {
  const locations = new Set<string>();
  for (const finding of [...result.findings, ...result.suppressedFindings]) {
    if (finding.location) locations.add(finding.location);
  }
  return Math.max(locations.size, 1);
}

/**
 * Word-wrap text to terminal width with indentation.
 */
function wrapText(text: string, width: number, indent: number): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const indentStr = ' '.repeat(Math.max(0, indent));
  const maxContentWidth = Math.max(10, width - indentStr.length);
  const output: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      output.push('');
      continue;
    }

    let current = '';
    const words = line.split(/\s+/);

    for (const word of words) {
      if (word.length > maxContentWidth) {
        if (current) {
          output.push(`${indentStr}${current}`);
          current = '';
        }

        let remainder = word;
        while (remainder.length > maxContentWidth) {
          output.push(`${indentStr}${remainder.slice(0, maxContentWidth)}`);
          remainder = remainder.slice(maxContentWidth);
        }

        current = remainder;
        continue;
      }

      const candidate = current ? `${current} ${word}` : word;
      if (candidate.length <= maxContentWidth) {
        current = candidate;
      } else {
        output.push(`${indentStr}${current}`);
        current = word;
      }
    }

    if (current) {
      output.push(`${indentStr}${current}`);
    }
  }

  return output.join('\n');
}

function getSeverityColor(c: typeof import('chalk').default, severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return (text) => c.red.bold(text);
    case Severity.High:
      return (text) => c.red(text);
    case Severity.Medium:
      return (text) => c.yellow(text);
    case Severity.Low:
      return (text) => c.blue(text);
    case Severity.Info:
      return (text) => c.gray(text);
  }
}

function getSeverityIcon(severity: Severity): string {
  switch (severity) {
    case Severity.Critical:
      return '✖';
    case Severity.High:
    case Severity.Medium:
      return '⚠';
    case Severity.Low:
    case Severity.Info:
      return 'ℹ';
  }
}

function formatSeverityHeader(severity: Severity, count: number, width: number): string {
  const label = `── ${severity.toUpperCase()} (${count}) `;
  const fill = Math.max(0, width - label.length);
  return `${label}${'─'.repeat(fill)}`;
}

function pushWrapped(
  lines: string[],
  text: string,
  width: number,
  indent: number,
  style?: (value: string) => string
): void {
  const wrapped = wrapText(text, width, indent).split('\n');
  for (const line of wrapped) {
    lines.push(style ? style(line) : line);
  }
}

function formatFixGuidance(fixGuidance: string, width: number): string[] {
  const lines: string[] = [];
  const rawLines = fixGuidance.replace(/\r\n/g, '\n').split('\n');
  const introIndex = rawLines.findIndex((line) => line.trim().length > 0);

  if (introIndex === -1) return lines;

  const intro = rawLines[introIndex].trim();
  lines.push(...wrapText(`Fix: ${intro}`, width, 4).split('\n'));

  const details = rawLines.slice(introIndex + 1);
  if (!details.some((line) => line.trim().length > 0)) {
    return lines;
  }

  lines.push('');

  let previousBlank = false;
  for (const detail of details) {
    const trimmed = detail.trim();

    if (!trimmed) {
      if (!previousBlank) {
        lines.push('');
      }
      previousBlank = true;
      continue;
    }

    previousBlank = false;
    lines.push(...wrapText(trimmed, width, 6).split('\n'));
  }

  return lines;
}

async function formatFinding(finding: Finding, projectPath: string, width: number): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];

  pushWrapped(lines, `${getSeverityIcon(finding.severity)} ${finding.title}`, width, 2, c.bold);

  const location = finding.location
    ? `${displayPath(projectPath, finding.location)}${finding.line ? `:${finding.line}` : ''}`
    : undefined;

  const metadataParts = [finding.ruleId, finding.severity.toUpperCase()];
  if (location) {
    metadataParts.push(location);
  }
  pushWrapped(lines, metadataParts.join(' · '), width, 4, c.dim);

  if (finding.description.trim().length > 0) {
    lines.push('');
    lines.push(...wrapText(finding.description, width, 4).split('\n'));
  }

  if (finding.fixGuidance.trim().length > 0) {
    lines.push('');
    lines.push(...formatFixGuidance(finding.fixGuidance, width));
  }

  if (finding.documentationURL) {
    lines.push('');
    pushWrapped(lines, `→ ${finding.documentationURL}`, width, 4, c.dim);
  }

  return lines.join('\n');
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const width = getTerminalWidth();
  const lines: string[] = [];

  const suppressedCount = result.suppressedFindings?.length ?? 0;
  const suppressedSuffix = suppressedCount > 0 ? ` (${suppressedCount} suppressed)` : '';

  // Header
  lines.push('');
  lines.push(c.bold.underline('🛡️  ShipLint Scan Results'));
  lines.push('');
  pushWrapped(lines, `📁 Project: ${result.projectPath}`, width, 0);
  lines.push(`🕐 Scanned: ${result.timestamp.toISOString()}`);
  lines.push(`⏱️  Duration: ${result.duration}ms`);
  lines.push(`📊 Rules run: ${result.rulesRun.length}`);
  if (suppressedCount > 0) {
    lines.push(`🔇 Suppressed: ${suppressedCount}`);
  }
  lines.push('');

  // Count by severity
  const bySeverity = new Map<Severity, Finding[]>();
  for (const finding of result.findings) {
    const existing = bySeverity.get(finding.severity) ?? [];
    existing.push(finding);
    bySeverity.set(finding.severity, existing);
  }

  const criticalCount = bySeverity.get(Severity.Critical)?.length ?? 0;
  const highCount = bySeverity.get(Severity.High)?.length ?? 0;
  const mediumCount = bySeverity.get(Severity.Medium)?.length ?? 0;

  // ═══ SHIP VERDICT ═══
  if (criticalCount > 0) {
    lines.push(c.red.bold(separator('═', width)));
    lines.push(c.red.bold(`  🚫 BLOCKED — ${criticalCount} issue(s) will cause App Store rejection${suppressedSuffix}`));
    lines.push(c.red.bold(separator('═', width)));
  } else if (highCount > 0) {
    lines.push(c.yellow.bold(separator('═', width)));
    lines.push(c.yellow.bold(`  ⚠️ WARNING — ${highCount} issue(s) likely to cause rejection${suppressedSuffix}`));
    lines.push(c.yellow.bold(separator('═', width)));
  } else if (result.findings.length > 0) {
    lines.push(c.blue.bold(separator('═', width)));
    lines.push(c.blue.bold(`  💡 ${result.findings.length} suggestion(s) to improve your submission${suppressedSuffix}`));
    lines.push(c.blue.bold(separator('═', width)));
  } else {
    lines.push(c.green.bold(separator('═', width)));
    lines.push(c.green.bold(`  ✅ READY — No issues found${suppressedSuffix}`));
    lines.push(c.green.bold(separator('═', width)));
  }

  const sortedFindings = [...result.findings].sort((a, b) => {
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  if (sortedFindings.length > 0) {
    let currentSeverity: Severity | null = null;

    for (const finding of sortedFindings) {
      if (finding.severity !== currentSeverity) {
        currentSeverity = finding.severity;
        const count = bySeverity.get(currentSeverity)?.length ?? 0;
        const color = getSeverityColor(c, currentSeverity);

        lines.push('');
        lines.push(color(formatSeverityHeader(currentSeverity, count, width)));
        lines.push('');
      }

      lines.push(await formatFinding(finding, result.projectPath, width));
      lines.push('');
    }
  }

  const criticalHigh = criticalCount + highCount;
  const medium = mediumCount;
  const lowInfo = (bySeverity.get(Severity.Low)?.length ?? 0) + (bySeverity.get(Severity.Info)?.length ?? 0);
  const checkedFiles = inferCheckedFileCount(result);

  lines.push(c.dim(separator('━', width)));
  lines.push(`Checked ${checkedFiles} files in ${result.duration}ms`);
  lines.push('');
  lines.push(
    `  ${c.red(`✖ ${criticalHigh} critical/high`)}    ${c.yellow(`⚠ ${medium} medium`)}    ${c.blue(`ℹ ${lowInfo} low/info`)}`
  );

  return lines.join('\n');
}
