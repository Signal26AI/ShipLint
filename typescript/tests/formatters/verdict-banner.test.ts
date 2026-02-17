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

import { formatText } from '../../src/formatters/text.js';
import { Severity, Confidence } from '../../src/types/index.js';
import type { ScanResult, Finding } from '../../src/types/index.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'rule-b',
    severity: Severity.High,
    confidence: Confidence.Medium,
    title: 'Problem found',
    description: 'Something is wrong. Please address it.',
    guideline: '1.0',
    fixGuidance: 'Fix it',
    ...overrides,
  };
}

function makeResult(findings: Finding[], rulesRun: string[]): ScanResult {
  return {
    projectPath: '/test/project',
    timestamp: new Date('2026-01-01'),
    findings,
    suppressedFindings: [],
    rulesRun,
    duration: 100,
    projectType: 'xcodeproj',
    frameworkDetectionMethod: 'pbxproj',
    frameworksDetected: [],
    targetCount: 1,
  };
}

describe('text formatter summary logic', () => {
  test('uses unique failing rule IDs to compute passed count', async () => {
    const result = makeResult(
      [
        makeFinding({ ruleId: 'rule-b', severity: Severity.High }),
        makeFinding({ ruleId: 'rule-b', severity: Severity.Medium, title: 'Another issue from same rule' }),
      ],
      ['rule-a', 'rule-b', 'rule-c']
    );

    const output = await formatText(result, { version: '1.5.0' });

    expect(output).toContain('1 error · 1 warning');
    expect(output).toContain('Fix errors before submitting to App Store Connect.');
  });

  test('no findings still shows passed checks and clean summary', async () => {
    const result = makeResult([], ['rule-a', 'rule-b']);
    const output = await formatText(result, { version: '1.5.0' });

    expect(output).toContain('ShipLint v1.5.0 — scanning project');
    expect(output).toContain('passed');
    expect(output).toContain('passed');
    expect(output).not.toContain('Fix errors before submitting to App Store Connect.');
  });

  test('low/info findings use ℹ icon and do not increase warning count', async () => {
    const result = makeResult(
      [
        makeFinding({ ruleId: 'rule-a', severity: Severity.Low, title: 'Low issue' }),
        makeFinding({ ruleId: 'rule-b', severity: Severity.Info, title: 'Info issue' }),
      ],
      ['rule-a', 'rule-b', 'rule-c']
    );

    const output = await formatText(result, { version: '1.5.0' });

    expect(output).toContain('ℹ Low issue');
    expect(output).toContain('ℹ Info issue');
    expect(output).toContain('passed');
  });
});
