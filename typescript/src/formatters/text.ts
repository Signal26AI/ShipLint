/**
 * Text formatter for human-readable output
 */
import type { ScanResult, Finding } from '../types/index.js';
import { Severity, Confidence } from '../types/index.js';

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

/**
 * Get severity color
 */
function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return (text) => chalk.redBright.bold(text);
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

function getSeverityBadge(severity: Severity): string {
  switch (severity) {
    case Severity.Critical:
      return chalk.bgRedBright.black.bold(' CRITICAL ');
    case Severity.High:
      return chalk.bgRed.black.bold(' HIGH ');
    case Severity.Medium:
      return chalk.bgYellow.black.bold(' MEDIUM ');
    case Severity.Low:
      return chalk.bgBlue.black.bold(' LOW ');
    case Severity.Info:
      return chalk.bgGray.black.bold(' INFO ');
  }
}

/**
 * Get confidence label
 */
function getConfidenceBadge(confidence: Confidence): string {
  switch (confidence) {
    case Confidence.High:
      return chalk.bgGreen.black.bold(' HIGH CONFIDENCE ');
    case Confidence.Medium:
      return chalk.bgYellow.black.bold(' MEDIUM CONFIDENCE ');
    case Confidence.Low:
      return chalk.bgMagenta.black.bold(' LOW CONFIDENCE ');
  }
}

function getFileGroup(location?: string): string {
  if (!location) {
    return 'project-wide';
  }

  const withLineOrColumn = location.match(/^(.*?):\d+(?::\d+)?$/);
  if (withLineOrColumn?.[1]) {
    return withLineOrColumn[1];
  }

  return location;
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

function renderStackedSummaryBar(counts: Map<Severity, number>, total: number, width = 28): string {
  if (total === 0) {
    return chalk.gray('░'.repeat(width));
  }

  const blocks: string[] = [];
  let filled = 0;
  let running = 0;

  for (const severity of SEVERITY_ORDER) {
    running += counts.get(severity) ?? 0;
    const shouldFill = Math.round((running / total) * width);
    const segmentLength = Math.max(0, shouldFill - filled);

    if (segmentLength > 0) {
      const color = getSeverityColor(severity);
      blocks.push(color('█'.repeat(segmentLength)));
      filled += segmentLength;
    }
  }

  if (filled < width) {
    blocks.push(chalk.gray('░'.repeat(width - filled)));
  }

  return blocks.join('');
}

function formatMultilineBlock(content: string, prefix: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trimEnd())
    .map((line) => `${prefix}${line}`);
}

/**
 * Format a single finding
 */
function formatFinding(finding: Finding, index: number): string {
  const severityColor = getSeverityColor(finding.severity);

  const lines: string[] = [];
  const findingNumber = `${index + 1}`.padStart(2, '0');

  lines.push(
    severityColor(`┌─ ${chalk.bold(`#${findingNumber}`)} ${getSeverityBadge(finding.severity)} ${chalk.whiteBright.bold(finding.title)}`)
  );

  const locationLabel = finding.location ? chalk.cyan(finding.location) : chalk.dim('project-wide');
  lines.push(`│  ${chalk.dim('Location:')} ${locationLabel}`);
  lines.push(`│  ${chalk.dim('Rule:')} ${chalk.bold(finding.ruleId)}  ${chalk.dim('Guideline:')} ${chalk.bold(finding.guideline)}`);
  lines.push(`│  ${chalk.dim('Signal:')} ${getConfidenceBadge(finding.confidence)}`);

  lines.push(`│`);
  lines.push(`│  ${chalk.dim.bold('Description')}`);
  lines.push(...formatMultilineBlock(finding.description, `│    `));

  lines.push(`│`);
  lines.push(`│  ${chalk.greenBright.bold('How to fix')}`);
  for (const line of finding.fixGuidance.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      lines.push('│');
      continue;
    }

    const bulletLine = trimmed.startsWith('-') || trimmed.startsWith('•')
      ? trimmed.replace(/^[-•]\s*/, '• ')
      : `• ${trimmed}`;

    lines.push(`│   ${chalk.green(bulletLine)}`);
  }

  if (finding.documentationURL) {
    lines.push(`│`);
    lines.push(`│  ${chalk.cyanBright('Docs:')} ${chalk.underline.cyan(finding.documentationURL)}`);
  }

  lines.push(severityColor('└─'));

  return lines.join('\n');
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult): Promise<string> {
  const c = await getChalk();
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(c.bold.cyanBright('┏━ ShipLint ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  lines.push(c.dim('   Catch App Store rejections before they happen'));
  lines.push(c.bold.cyanBright('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  lines.push('');

  lines.push(`${c.dim('Project')}   ${c.bold(result.projectPath)}`);
  lines.push(`${c.dim('Scanned')}   ${result.timestamp.toISOString()}`);
  lines.push(`${c.dim('Duration')}  ${result.duration}ms`);
  lines.push(`${c.dim('Rules')}    ${result.rulesRun.length}`);
  lines.push('');

  const counts = summarizeBySeverity(result.findings);
  const total = result.findings.length;

  lines.push(c.bold('Summary'));
  lines.push(`  ${renderStackedSummaryBar(counts, total)} ${c.bold(String(total))} finding${total === 1 ? '' : 's'}`);

  for (const severity of SEVERITY_ORDER) {
    const count = counts.get(severity) ?? 0;
    if (count === 0) {
      continue;
    }

    lines.push(`  ${getSeverityBadge(severity)} ${count}`);
  }

  if (total === 0) {
    lines.push('');
    lines.push(c.bgGreen.black.bold(' PASS ') + c.greenBright(' No issues found. Your app looks ready for review.'));
    lines.push('');
    return lines.join('\n');
  }

  lines.push('');
  lines.push(c.bold('Findings'));

  // Sort findings by severity, then by file group, then rule id
  const sortedFindings = [...result.findings].sort((a, b) => {
    const severityDelta = getSeverityRank(a.severity) - getSeverityRank(b.severity);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    const fileA = getFileGroup(a.location);
    const fileB = getFileGroup(b.location);
    const fileDelta = fileA.localeCompare(fileB);
    if (fileDelta !== 0) {
      return fileDelta;
    }

    return a.ruleId.localeCompare(b.ruleId);
  });

  const grouped = new Map<string, Finding[]>();
  for (const finding of sortedFindings) {
    const key = getFileGroup(finding.location);
    const existing = grouped.get(key) ?? [];
    existing.push(finding);
    grouped.set(key, existing);
  }

  let findingIndex = 0;
  for (const [fileGroup, findings] of grouped) {
    lines.push('');
    lines.push(c.bold.cyan(`▸ ${fileGroup}`));

    for (const finding of findings) {
      lines.push(formatFinding(finding, findingIndex));
      lines.push('');
      findingIndex += 1;
    }
  }

  const criticalCount = counts.get(Severity.Critical) ?? 0;
  const highCount = counts.get(Severity.High) ?? 0;
  const blocksRelease = criticalCount + highCount > 0;

  lines.push(c.dim('─'.repeat(68)));
  if (blocksRelease) {
    lines.push(c.bgRed.white.bold(' FAIL ') + c.redBright(` ${criticalCount + highCount} blocking issue(s) (critical/high).`));
  } else {
    lines.push(c.bgYellow.black.bold(' WARN ') + c.yellowBright(' Issues found, but none are critical/high.'));
  }

  lines.push(c.dim('Tip: run with --format json for CI-friendly output.'));
  lines.push('');

  return lines.join('\n');
}
