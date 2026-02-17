// Mock chalk to avoid ESM issues in Jest
const passthrough = (text: string) => text;
const handler: ProxyHandler<any> = {
  get: (_target: any, prop: string) => {
    if (prop === 'default') return new Proxy(passthrough, handler);
    if (prop === '__esModule') return true;
    if (prop === 'then') return undefined; // prevent Promise-like behavior
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
    ruleId: 'test-001',
    severity: Severity.Info,
    confidence: Confidence.Medium,
    title: 'Test finding',
    description: 'A test finding',
    guideline: '1.0',
    fixGuidance: 'Fix it',
    ...overrides,
  };
}

function makeResult(findings: Finding[]): ScanResult {
  return {
    projectPath: '/test/project',
    timestamp: new Date('2026-01-01'),
    findings,
    suppressedFindings: [],
    rulesRun: ['test-001'],
    duration: 100,
    projectType: 'xcodeproj',
    frameworkDetectionMethod: 'pbxproj',
    frameworksDetected: [],
    targetCount: 1,
  };
}

describe('Verdict banner logic', () => {
  test('CRITICAL findings → BLOCKED', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Critical, title: 'Critical problem' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('🚫 BLOCKED');
    expect(output).toContain('will cause App Store rejection');
  });

  test('HIGH findings without CRITICAL → WARNING', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.High, title: 'Some high issue' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('⚠️ WARNING');
    expect(output).toContain('likely to cause rejection');
    expect(output).not.toContain('🚫 BLOCKED');
  });

  test('MEDIUM/LOW/INFO only → suggestions', async () => {
    const result = makeResult([
      makeFinding({ severity: Severity.Medium, title: 'Some medium issue' }),
      makeFinding({ severity: Severity.Info, title: 'Some info issue' }),
    ]);
    const output = await formatText(result);
    expect(output).toContain('💡 2 suggestion(s) to improve your submission');
    expect(output).not.toContain('⚠️ WARNING');
    expect(output).not.toContain('🚫 BLOCKED');
  });

  test('no findings → READY', async () => {
    const result = makeResult([]);
    const output = await formatText(result);
    expect(output).toContain('✅ READY — No issues found');
  });

  test('separator width follows terminal width and caps at 100', async () => {
    const original = process.stdout.columns;
    try {
      Object.defineProperty(process.stdout, 'columns', { value: 140, configurable: true });
      const output = await formatText(makeResult([makeFinding({ severity: Severity.High })]));
      expect(output).toContain('═'.repeat(100));
    } finally {
      Object.defineProperty(process.stdout, 'columns', { value: original, configurable: true });
    }
  });
});
