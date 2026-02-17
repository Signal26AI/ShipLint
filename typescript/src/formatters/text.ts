/**
 * Text formatter for human-readable output
 */
import { promises as fs } from 'node:fs';
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

const SEVERITY_ORDER: Severity[] = [
  Severity.Critical,
  Severity.High,
  Severity.Medium,
  Severity.Low,
  Severity.Info,
];

interface ParsedLocation {
  filePath?: string;
  line?: number;
  column?: number;
  displayPath: string;
}

function getSeverityRank(severity: Severity): number {
  switch (severity) {
    case Severity.Critical:
      return 0;
    case Severity.High:
      return 1;
    case Severity.Medium:
      return 2;
    case Severity.Low:
      return 3;
    case Severity.Info:
      return 4;
  }
}

function getSeverityColor(c: typeof import('chalk').default, severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return (text) => c.redBright.bold(text);
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

function getSeverityLabel(severity: Severity): string {
  return severity.toUpperCase();
}

function parseLocation(location?: string): ParsedLocation {
  if (!location) {
    return { displayPath: 'project-wide' };
  }

  const withLineCol = location.match(/^(.*):(\d+):(\d+)$/);
  if (withLineCol) {
    return {
      filePath: withLineCol[1],
      line: Number.parseInt(withLineCol[2], 10),
      column: Number.parseInt(withLineCol[3], 10),
      displayPath: withLineCol[1],
    };
  }

  const withLine = location.match(/^(.*):(\d+)$/);
  if (withLine) {
    return {
      filePath: withLine[1],
      line: Number.parseInt(withLine[2], 10),
      displayPath: withLine[1],
    };
  }

  return {
    filePath: location,
    displayPath: location,
  };
}

function summarizeBySeverity(findings: Finding[]): Map<Severity, number> {
  const counts = new Map<Severity, number>();
  for (const severity of SEVERITY_ORDER) {
    counts.set(severity, 0);
  }

  for (const finding of findings) {
    counts.set(finding.severity, (counts.get(finding.severity) ?? 0) + 1);
  }

  return counts;
}

function getSurroundingLines(lines: string[], line: number): { start: number; end: number } {
  const before = 1;
  const after = 1;
  const start = Math.max(1, line - before);
  const end = Math.min(lines.length, line + after);
  return { start, end };
}

function getCaretLength(lineText: string, column: number): number {
  const startIndex = Math.max(0, Math.min(column - 1, lineText.length));
  const fromColumn = lineText.slice(startIndex);
  const token = fromColumn.match(/^\S+/)?.[0] ?? '';

  if (token.length > 0) {
    return Math.max(3, Math.min(token.length, 48));
  }

  return 3;
}

async function readFileLines(filePath: string, cache: Map<string, string[] | null>): Promise<string[] | null> {
  if (cache.has(filePath)) {
    return cache.get(filePath) ?? null;
  }

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    cache.set(filePath, lines);
    return lines;
  } catch {
    cache.set(filePath, null);
    return null;
  }
}

function formatHelpLines(helpText: string): string[] {
  const parts = helpText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (parts.length === 0) {
    return [];
  }

  const [first, ...rest] = parts;
  return [`  = help: ${first}`, ...rest.map((line) => `          ${line}`)];
}

async function formatFinding(
  c: typeof import('chalk').default,
  finding: Finding,
  fileCache: Map<string, string[] | null>,
): Promise<string> {
  const severityColor = getSeverityColor(c, finding.severity);
  const parsedLocation = parseLocation(finding.location);
  const severityLabel = getSeverityLabel(finding.severity);

  const locationPrefix = parsedLocation.line !== undefined
    ? `${parsedLocation.displayPath}:${parsedLocation.line}:${parsedLocation.column ?? 1}`
    : parsedLocation.displayPath;

  const lines: string[] = [];
  lines.push(
    `${c.bold(locationPrefix)}: ${c.bold(finding.ruleId)} ${severityColor(`[${severityLabel}]`)} ${c.whiteBright(finding.title)}`,
  );

  let renderedSource = false;

  if (parsedLocation.filePath && parsedLocation.line !== undefined) {
    const fileLines = await readFileLines(parsedLocation.filePath, fileCache);

    if (fileLines && parsedLocation.line > 0 && parsedLocation.line <= fileLines.length) {
      const { start, end } = getSurroundingLines(fileLines, parsedLocation.line);
      const width = String(end).length;

      lines.push('  |');

      for (let lineNumber = start; lineNumber <= end; lineNumber += 1) {
        const lineText = fileLines[lineNumber - 1] ?? '';
        lines.push(`${String(lineNumber).padStart(width, ' ')} | ${lineText}`);

        if (lineNumber === parsedLocation.line && parsedLocation.column !== undefined) {
          const caretPadding = ' '.repeat(Math.max(0, parsedLocation.column - 1));
          const caretLength = getCaretLength(lineText, parsedLocation.column);
          lines.push(
            `${' '.repeat(width)} | ${caretPadding}${severityColor('^'.repeat(caretLength))} ${c.dim(finding.ruleId)}`,
          );
        }
      }

      lines.push('  |');
      renderedSource = true;
    }
  }

  if (!renderedSource && parsedLocation.line !== undefined) {
    lines.push('  = note: Source context unavailable');
  }

  if (finding.description.trim().length > 0 && finding.description.trim() !== finding.title.trim()) {
    lines.push(`  = note: ${finding.description.trim()}`);
  }

  lines.push(...formatHelpLines(finding.fixGuidance));

  if (finding.documentationURL) {
    lines.push(`  = docs: ${c.underline.cyan(finding.documentationURL)}`);
  }

  return lines.join('\n');
}

function getComparableFilePath(location?: string): string {
  return parseLocation(location).displayPath;
}

function getCheckedFileCount(result: ScanResult): number {
  const files = new Set<string>();
  for (const finding of result.findings) {
    const parsed = parseLocation(finding.location);
    if (parsed.filePath) {
      files.add(parsed.filePath);
    }
  }

  if (files.size > 0) {
    return files.size;
  }

  if (result.targetCount > 0) {
    return result.targetCount;
  }

  return 1;
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];

  const counts = summarizeBySeverity(result.findings);
  const total = result.findings.length;

  const sortedFindings = [...result.findings].sort((a, b) => {
    const severityDelta = getSeverityRank(a.severity) - getSeverityRank(b.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const fileDelta = getComparableFilePath(a.location).localeCompare(getComparableFilePath(b.location));
    if (fileDelta !== 0) {
      return fileDelta;
    }

    return a.ruleId.localeCompare(b.ruleId);
  });

  const fileCache = new Map<string, string[] | null>();

  for (const finding of sortedFindings) {
    lines.push(await formatFinding(c, finding, fileCache));
    lines.push('');
  }

  const criticalHighCount = (counts.get(Severity.Critical) ?? 0) + (counts.get(Severity.High) ?? 0);
  const mediumCount = counts.get(Severity.Medium) ?? 0;
  const lowInfoCount = (counts.get(Severity.Low) ?? 0) + (counts.get(Severity.Info) ?? 0);

  const checkedFileCount = getCheckedFileCount(result);

  lines.push(c.dim('━'.repeat(40)));
  lines.push(`Checked ${c.bold(String(checkedFileCount))} file${checkedFileCount === 1 ? '' : 's'} in ${c.bold(`${result.duration}ms`)}`);
  lines.push('');
  lines.push(
    `  ${c.red('✖')} ${c.bold(String(criticalHighCount))} critical/high    ${c.yellow('⚠')} ${c.bold(String(mediumCount))} medium    ${c.blue('ℹ')} ${c.bold(String(lowInfoCount))} low/info`,
  );
  lines.push('');

  if (total === 0) {
    lines.push(c.green('✅ No issues found! Ready for App Store review.'));
  } else {
    lines.push(c.dim('Run `shiplint scan --format json .` for machine-readable output.'));
  }

  return lines.join('\n');
}
