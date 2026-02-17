/**
 * Text formatter for human-readable output
 * Final CLI design: compact, confidence-building, and actionable.
 */
import * as path from 'path';
import type { ScanResult, Finding } from '../types/index.js';
import { Severity } from '../types/index.js';
import { allRules } from '../rules/index.js';
import packageJson from '../../package.json';

// Dynamic import for chalk (ESM)
let chalk: typeof import('chalk').default;

async function getChalk() {
  if (!chalk) {
    const module = await import('chalk');
    chalk = module.default;
  }
  return chalk;
}

export interface TextFormatOptions {
  verbose?: boolean;
  version?: string;
}

const FINDING_ORDER: Record<Severity, number> = {
  [Severity.Critical]: 0,
  [Severity.High]: 1,
  [Severity.Medium]: 2,
  [Severity.Low]: 3,
  [Severity.Info]: 4,
};

const RULE_NAME_BY_ID = new Map(allRules.map((rule) => [rule.id, rule.name]));

const PASSED_LABEL_OVERRIDES: Record<string, string> = {
  'privacy-001-missing-camera-purpose': 'Camera usage description present',
  'privacy-002-missing-location-purpose': 'Location usage descriptions present',
  'privacy-003-att-tracking-mismatch': 'Tracking transparency configuration consistent',
  'privacy-004-missing-photo-library-purpose': 'Photo library usage description present',
  'privacy-005-missing-microphone-purpose': 'Microphone usage description present',
  'privacy-006-missing-contacts-purpose': 'Contacts usage description present',
  'privacy-007-location-always-unjustified': 'Location Always access has justification',
  'privacy-008-missing-bluetooth-purpose': 'Bluetooth usage description present',
  'privacy-009-missing-face-id-purpose': 'Face ID usage description present',
  'privacy-010-required-reason-api': 'Required-reason API declarations present',
  'auth-001-third-party-login-no-siwa': 'Sign in with Apple compliance OK',
  'metadata-001-missing-privacy-manifest': 'Privacy manifest assets present',
  'metadata-002-missing-supported-orientations': 'Supported orientations configured',
  'config-001-ats-exception-without-justification': 'ATS exceptions justified',
  'config-002-missing-encryption-flag': 'Export compliance flag configured',
  'config-003-missing-launch-storyboard': 'Launch storyboard configured',
  'code-001-private-api-usage': 'No private API usage detected',
  'code-003-dynamic-code-execution': 'No dynamic code execution detected',
};

function getIconForSeverity(severity: Severity): string {
  switch (severity) {
    case Severity.Critical:
    case Severity.High:
      return '✖';
    case Severity.Medium:
      return '△';
    case Severity.Low:
    case Severity.Info:
      return 'ℹ';
  }
}

function getSeverityColor(c: typeof import('chalk').default, severity: Severity): (text: string) => string {
  switch (severity) {
    case Severity.Critical:
      return c.red.bold;
    case Severity.High:
      return c.red;
    case Severity.Medium:
      return c.yellow;
    case Severity.Low:
    case Severity.Info:
      return c.blue;
  }
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const sentenceMatch = normalized.match(/^(.+?[.!?])(?=\s|$)/);
  if (sentenceMatch) {
    return sentenceMatch[1];
  }

  return normalized;
}

function shortExplanation(finding: Finding): string {
  const sentence = firstSentence(finding.description);
  const fallback = finding.description.replace(/\s+/g, ' ').trim();
  const candidate = sentence || fallback || 'Needs attention before submission.';
  return truncate(candidate, 80);
}

function wrapText(text: string, width: number): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const wrapped: string[] = [];

  for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
    const words = paragraphs[pIndex].split(' ');
    let line = '';

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length <= width) {
        line = next;
      } else {
        if (line) wrapped.push(line);
        line = word;
      }
    }

    if (line) wrapped.push(line);
    if (pIndex < paragraphs.length - 1) wrapped.push('');
  }

  return wrapped;
}

function boxify(content: string, maxWidth = 70): string[] {
  const rawLines = content
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return [];
  }

  const lines = rawLines.map((line) => truncate(line, maxWidth));
  const width = Math.max(...lines.map((line) => line.length), 1);

  const top = `┌${'─'.repeat(width + 2)}┐`;
  const middle = lines.map((line) => `│ ${line.padEnd(width, ' ')} │`);
  const bottom = `└${'─'.repeat(width + 2)}┘`;

  return [top, ...middle, bottom];
}

function displayProjectName(projectPath: string): string {
  const input = projectPath.trim();
  const target = input === '.' ? process.cwd() : input;
  const normalized = path.resolve(target);
  return path.basename(normalized) || projectPath;
}

function fallbackPassedLabel(ruleId: string): string {
  const ruleName = RULE_NAME_BY_ID.get(ruleId) ?? ruleId;

  if (ruleName.startsWith('Missing ')) {
    return `${ruleName.replace(/^Missing\s+/, '')} present`;
  }

  if (ruleName.includes(' Without ')) {
    return `${ruleName.replace(' Without ', ' with ')} OK`;
  }

  return `${ruleName} OK`;
}

function passedLabel(ruleId: string): string {
  return PASSED_LABEL_OVERRIDES[ruleId] ?? fallbackPassedLabel(ruleId);
}

function getPassedRuleIds(result: ScanResult): string[] {
  const failing = new Set(result.findings.map((finding) => finding.ruleId));
  const seen = new Set<string>();
  const passed: string[] = [];

  for (const ruleId of result.rulesRun) {
    if (seen.has(ruleId)) continue;
    seen.add(ruleId);
    if (!failing.has(ruleId)) {
      passed.push(ruleId);
    }
  }

  return passed;
}

async function formatFinding(finding: Finding, verbose: boolean): Promise<string[]> {
  const c = await getChalk();
  const color = getSeverityColor(c, finding.severity);
  const icon = getIconForSeverity(finding.severity);

  const lines: string[] = [];
  lines.push(`  ${color(`${icon} ${finding.title}`)}`);
  lines.push(`    ${color(`→ ${shortExplanation(finding)}`)}`);

  if (!verbose) {
    return lines;
  }

  const fullDescription = finding.description.replace(/\s+/g, ' ').trim();
  if (fullDescription) {
    lines.push('');
    for (const wrappedLine of wrapText(fullDescription, 76)) {
      lines.push(wrappedLine ? `    ${wrappedLine}` : '');
    }
  }

  if (finding.fixGuidance.trim()) {
    lines.push('');
    lines.push('    Suggested fix:');
    for (const boxLine of boxify(finding.fixGuidance, 68)) {
      lines.push(`    ${boxLine}`);
    }
  }

  if (finding.documentationURL) {
    lines.push('');
    lines.push(`    → ${finding.documentationURL}`);
  }

  return lines;
}

/**
 * Format scan results as text
 */
export async function formatText(result: ScanResult, options: TextFormatOptions = {}): Promise<string> {
  const c = await getChalk();
  const verbose = options.verbose ?? false;
  const version = options.version ?? packageJson.version;

  const sortedFindings = [...result.findings].sort((a, b) => {
    const bySeverity = FINDING_ORDER[a.severity] - FINDING_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return a.title.localeCompare(b.title);
  });

  const passedRuleIds = getPassedRuleIds(result);
  const passedCount = Math.max(0, result.rulesRun.length - new Set(result.findings.map((f) => f.ruleId)).size);
  const errorCount = result.findings.filter(
    (finding) => finding.severity === Severity.Critical || finding.severity === Severity.High
  ).length;
  const warningCount = result.findings.filter((finding) => finding.severity === Severity.Medium).length;

  const lines: string[] = [];
  lines.push(`ShipLint v${version} — scanning ${displayProjectName(result.projectPath)}`);
  lines.push('');

  for (const ruleId of passedRuleIds) {
    lines.push(`  ${c.green(`✓ ${passedLabel(ruleId)}`)}`);
  }

  if (passedRuleIds.length > 0 && sortedFindings.length > 0) {
    lines.push('');
  }

  for (let i = 0; i < sortedFindings.length; i++) {
    const finding = sortedFindings[i];
    lines.push(...(await formatFinding(finding, verbose)));
    if (i < sortedFindings.length - 1) {
      lines.push('');
    }
  }

  if (passedRuleIds.length > 0 || sortedFindings.length > 0) {
    lines.push('');
  }

  lines.push(
    `${c.red(`${errorCount} errors`)} · ${c.yellow(`${warningCount} warnings`)} · ${c.green(`${passedCount} passed`)}`
  );

  if (errorCount > 0) {
    lines.push('Fix errors before submitting to App Store Connect.');
  }

  return lines.join('\n');
}
