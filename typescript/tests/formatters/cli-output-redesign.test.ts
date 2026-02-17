// Mock chalk to avoid ESM issues in Jest
const passthrough = (text: string) => text;
const handler: ProxyHandler<any> = {
  get: (_target: any, prop: string) => {
    if (prop === 'default') return new Proxy(passthrough, handler);
    if (prop === '__esModule') return true;
    if (prop === 'then') return undefined;
    return new Proxy(passthrough, handler);
  },
  apply: (_target: any, _thisArg: any, args: any[]) => args[0],
};
jest.mock('chalk', () => new Proxy(passthrough, handler));

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatText } from '../../src/formatters/text.js';
import { formatXcode } from '../../src/formatters/xcode.js';
import { Severity, Confidence } from '../../src/types/index.js';
import type { ScanResult, Finding } from '../../src/types/index.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'privacy-010',
    severity: Severity.Medium,
    confidence: Confidence.High,
    title: 'Missing privacy manifest declaration',
    description: 'Privacy manifest declaration is missing.',
    location: 'Sources/App.swift',
    line: 2,
    guideline: '5.1.1',
    fixGuidance: 'Add NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1',
    documentationURL: 'https://shiplint.app/errors/itms-91053',
    ...overrides,
  };
}

function makeResult(projectPath: string, findings: Finding[]): ScanResult {
  return {
    projectPath,
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    findings,
    suppressedFindings: [],
    rulesRun: ['privacy-010'],
    duration: 42,
    projectType: 'xcodeproj',
    frameworkDetectionMethod: 'pbxproj',
    frameworksDetected: [],
    targetCount: 1,
  };
}

describe('CLI output redesign', () => {
  test('text formatter shows rust-style diagnostic when location + line are available', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-format-'));
    const srcDir = path.join(tmp, 'Sources');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'App.swift'),
      ['import Foundation', 'let saved = UserDefaults.standard.bool(forKey: "onboarded")', 'if saved { return }'].join('\n')
    );

    const output = await formatText(makeResult(tmp, [makeFinding()]));

    expect(output).toContain('Sources/App.swift:2:');
    expect(output).toContain('privacy-010 [MEDIUM] Missing privacy manifest declaration');
    expect(output).toContain('^');
    expect(output).toContain('= help: Add NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1');
    expect(output).toContain('= docs: https://shiplint.app/errors/itms-91053');
    expect(output).toContain('Checked 1 files in 42ms');
  });

  test('text formatter degrades gracefully without source line info', async () => {
    const finding = makeFinding({ location: undefined, line: undefined });
    const output = await formatText(makeResult('/tmp/project', [finding]));

    expect(output).toContain('privacy-010 [MEDIUM] Missing privacy manifest declaration');
    expect(output).toContain('description: Privacy manifest declaration is missing.');
    expect(output).toContain('help: Add NSPrivacyAccessedAPICategoryUserDefaults with reason CA92.1');
  });

  test('xcode formatter emits native warning lines', () => {
    const output = formatXcode(makeResult('/tmp/project', [makeFinding()]));
    expect(output).toBe(
      'Sources/App.swift:2:1: warning: Missing privacy manifest declaration (privacy-010)'
    );
  });
});
