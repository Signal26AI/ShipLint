/**
 * Text formatter for human-readable output
 * v1.5: Rust-style diagnostics + verdict banner + severity grouping
 */
import * as fs from 'fs';
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
 * Get severity color
 */
function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return (text) => chalk.red.bold(text);
    case Severity.High:
      return (text) => chalk.red(text);
    case Severity.Medium:
      return (text) => chalk.yellow(text);
    case Severity.Low:
      return (text) => chalk.blue(text);
    case Severity.Info:
      return (text) => chalk.gray(text);
  }
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

const SOURCE_CACHE = new Map<string, string[]>();

function isReadableFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveLocationPath(projectPath: string, location: string): string | undefined {
  if (path.isAbsolute(location) && isReadableFile(location)) {
    return location;
  }

  const candidates = [
    path.resolve(projectPath, location),
    path.resolve(process.cwd(), location),
  ];

  for (const candidate of candidates) {
    if (isReadableFile(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function getSourceLines(filePath: string): string[] | undefined {
  if (SOURCE_CACHE.has(filePath)) {
    return SOURCE_CACHE.get(filePath);
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    SOURCE_CACHE.set(filePath, lines);
    return lines;
  } catch {
    return undefined;
  }
}

function getCaretColumn(lineText: string): number {
  const firstNonWhitespace = lineText.search(/\S/);
  if (firstNonWhitespace === -1) return 1;
  return firstNonWhitespace + 1;
}

function getCaretLength(lineText: string): number {
  const trimmed = lineText.trimStart();
  if (!trimmed) return 1;
  const firstToken = trimmed.split(/\s+/)[0] || '';
  return Math.max(1, Math.min(24, firstToken.length));
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

function getTerminalWidth(): number {
  return Math.min(process.stdout.columns || 80, 100);
}

function separator(char: string): string {
  return char.repeat(getTerminalWidth());
}

async function formatFinding(finding: Finding, projectPath: string): Promise<string> {
  const c = await getChalk();
  const severityColor = getSeverityColor(finding.severity);
  const severityLabel = finding.severity.toUpperCase();
  const lines: string[] = [];

  if (finding.location && finding.line) {
    const sourcePath = resolveLocationPath(projectPath, finding.location);
    const shownPath = displayPath(projectPath, finding.location);

    let column = 1;
    let caretLength = 1;
    let sourceLines: string[] | undefined;

    if (sourcePath) {
      sourceLines = getSourceLines(sourcePath);
      const lineText = sourceLines?.[finding.line - 1] ?? '';
      column = getCaretColumn(lineText);
      caretLength = getCaretLength(lineText);
    }

    lines.push(
      `${c.bold(`${shownPath}:${finding.line}:${column}:`)} ${finding.ruleId} ${severityColor(`[${severityLabel}]`)} ${c.bold(finding.title)}`
    );

    if (sourceLines && sourceLines[finding.line - 1] !== undefined) {
      const startLine = Math.max(1, finding.line - 1);
      const endLine = Math.min(sourceLines.length, finding.line + 1);

      lines.push('  |');
      for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
        const text = sourceLines[lineNumber - 1] ?? '';
        lines.push(`${String(lineNumber).padStart(3, ' ')} | ${text}`);
        if (lineNumber === finding.line) {
          lines.push(`    | ${' '.repeat(Math.max(0, column - 1))}${'^'.repeat(caretLength)} ${finding.ruleId}`);
        }
      }
      lines.push('  |');
    } else {
      lines.push('  |');
      lines.push(`  = location: ${shownPath}`);
      lines.push('  |');
    }

    const helpLines = finding.fixGuidance.split('\n').filter(Boolean);
    for (const help of helpLines) {
      lines.push(c.green(`  = help: ${help}`));
    }
    if (finding.documentationURL) {
      lines.push(c.cyan(`  = docs: ${finding.documentationURL}`));
    }

    return lines.join('\n');
  }

  lines.push(`${finding.ruleId} ${severityColor(`[${severityLabel}]`)} ${c.bold(finding.title)}`);
  if (finding.location) {
    lines.push(c.dim(`  location: ${displayPath(projectPath, finding.location)}`));
  }
  lines.push(`  description: ${finding.description}`);
  for (const help of finding.fixGuidance.split('\n').filter(Boolean)) {
    lines.push(c.green(`  help: ${help}`));
  }
  if (finding.documentationURL) {
    lines.push(c.cyan(`  docs: ${finding.documentationURL}`));
  }

  return lines.join('\n');
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];
  const suppressedCount = result.suppressedFindings?.length ?? 0;
  const suppressedSuffix = suppressedCount > 0 ? ` (${suppressedCount} suppressed)` : '';

  // Header
  lines.push(c.bold.underline('\n🛡️  ShipLint Scan Results\n'));
  lines.push(`📁 Project: ${result.projectPath}`);
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
    lines.push(c.red.bold(separator('═')));
    lines.push(c.red.bold(`  🚫 BLOCKED — ${criticalCount} issue(s) will cause App Store rejection${suppressedSuffix}`));
    lines.push(c.red.bold(separator('═')));
  } else if (highCount > 0) {
    lines.push(c.yellow.bold(separator('═')));
    lines.push(c.yellow.bold(`  ⚠️ WARNING — ${highCount} issue(s) likely to cause rejection${suppressedSuffix}`));
    lines.push(c.yellow.bold(separator('═')));
  } else if (result.findings.length > 0) {
    lines.push(c.blue.bold(separator('═')));
    lines.push(c.blue.bold(`  💡 ${result.findings.length} suggestion(s) to improve your submission${suppressedSuffix}`));
    lines.push(c.blue.bold(separator('═')));
  } else {
    lines.push(c.green.bold(separator('═')));
    lines.push(c.green.bold(`  ✅ READY — No issues found${suppressedSuffix}`));
    lines.push(c.green.bold(separator('═')));
  }

  const sortedFindings = [...result.findings].sort((a, b) => {
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  if (sortedFindings.length > 0) {
    lines.push('');

    let currentSeverity: Severity | null = null;
    for (const finding of sortedFindings) {
      if (finding.severity !== currentSeverity) {
        currentSeverity = finding.severity;
        const color = getSeverityColor(currentSeverity);
        const count = bySeverity.get(currentSeverity)?.length ?? 0;
        lines.push('');
        lines.push(color(separator('─')));
        lines.push(color(`  ${currentSeverity.toUpperCase()} (${count})`));
        lines.push(color(separator('─')));
        lines.push('');
      }

      lines.push(await formatFinding(finding, result.projectPath));
      lines.push('');
    }
  }

  const criticalHigh = criticalCount + highCount;
  const medium = mediumCount;
  const lowInfo = (bySeverity.get(Severity.Low)?.length ?? 0) + (bySeverity.get(Severity.Info)?.length ?? 0);
  const checkedFiles = inferCheckedFileCount(result);

  lines.push(c.dim(separator('━')));
  lines.push(`Checked ${checkedFiles} files in ${result.duration}ms`);
  lines.push('');
  lines.push(
    `  ${c.red(`✖ ${criticalHigh} critical/high`)}    ${c.yellow(`⚠ ${medium} medium`)}    ${c.blue(`ℹ ${lowInfo} low/info`)}`
  );

  return lines.join('\n');
}
