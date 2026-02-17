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
import { formatXcode } from '../../src/formatters/xcode.js';
import { Severity, Confidence } from '../../src/types/index.js';
import type { ScanResult, Finding } from '../../src/types/index.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'privacy-010-required-reason-api',
    severity: Severity.High,
    confidence: Confidence.High,
    title: 'Missing PrivacyInfo.xcprivacy for UserDefaults API',
    description: 'Apple will reject with ITMS-91053. Add a privacy manifest that declares required-reason API usage.',
    location: 'App/PrivacyInfo.xcprivacy',
    guideline: '5.1.2',
    fixGuidance: '<key>NSPrivacyAccessedAPIType</key>\n<string>NSPrivacyAccessedAPICategoryUserDefaults</string>',
    documentationURL: 'https://developer.apple.com/documentation/bundleresources/privacy_manifest_files',
    shortFixText: undefined,
    ...overrides,
  };
}

function makeResult(findings: Finding[]): ScanResult {
  return {
    projectPath: '/tmp/VibeApp.xcodeproj',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    findings,
    suppressedFindings: [],
    rulesRun: [
      'privacy-001-missing-camera-purpose',
      'privacy-010-required-reason-api',
      'config-001-ats-exception-without-justification',
    ],
    duration: 42,
    projectType: 'xcodeproj',
    frameworkDetectionMethod: 'pbxproj',
    frameworksDetected: [],
    targetCount: 1,
  };
}

describe('CLI output redesign', () => {
  test('default text formatter shows compact header, findings and summary', async () => {
    const output = await formatText(
      makeResult([
        makeFinding(),
        makeFinding({
          ruleId: 'config-001-ats-exception-without-justification',
          severity: Severity.Medium,
          title: 'ATS exception for *.example.com',
          description: 'Needs written justification. Otherwise reviewers may reject this networking configuration.',
          fixGuidance: 'Document why ATS must be relaxed for this domain.',
          documentationURL: undefined,
        }),
      ]),
      { version: '1.5.0' }
    );

    expect(output).toContain('ShipLint v1.5.0 — scanning VibeApp.xcodeproj');
    // passing checks removed from default output

    expect(output).toContain('✖ Missing PrivacyInfo.xcprivacy for UserDefaults API');
    expect(output).toContain('→ Apple will reject with ITMS-91053.');
    expect(output).toContain('△ ATS exception for *.example.com');
    expect(output).toContain('→ Needs written justification.');

    expect(output).toContain('1 error · 1 warning');

    expect(output).not.toContain('description:');
    expect(output).not.toContain('help:');
    expect(output).not.toContain('location:');
    expect(output).not.toContain('──');
    expect(output).not.toContain('Suggested fix:');

    // const passedIndex = output.indexOf('✓ Camera usage description present');
    const findingIndex = output.indexOf('✖ Missing PrivacyInfo.xcprivacy for UserDefaults API');
    // expect(passedIndex).toBeGreaterThan(-1);
    expect(findingIndex).toBeGreaterThan(-1);
    // expect(passedIndex).toBeLessThan(findingIndex);
  });

  test('verbose mode shows clean layout with fix box and divider', async () => {
    const output = await formatText(
      makeResult([
        makeFinding({
          description:
            'Your app uses UserDefaults but has no privacy manifest. Since May 2024, Apple requires PrivacyInfo.xcprivacy.',
        }),
      ]),
      { verbose: true, version: '1.5.0' }
    );

    expect(output).toContain('✖ Missing PrivacyInfo.xcprivacy for UserDefaults API');
    expect(output).toContain('→ Your app uses UserDefaults but has no privacy manifest.');
    // No description paragraph (removed in redesign)
    expect(output).not.toContain('Suggested fix:');
    expect(output).not.toContain('┌');
    expect(output).not.toContain('└');
    // Fix box uses │ prefix
    expect(output).toContain('Fix:');
    expect(output).toMatch(/│.*NSPrivacyAccessedAPIType/);
    expect(output).toContain('→ https://developer.apple.com/documentation/bundleresources/privacy_manifest_files');
  });

  test('xcode formatter emits native warning lines', () => {
    const output = formatXcode(makeResult([makeFinding()]));
    expect(output).toBe(
      'App/PrivacyInfo.xcprivacy:1:1: warning: Missing PrivacyInfo.xcprivacy for UserDefaults API (privacy-010-required-reason-api)'
    );
  });
});

describe('inline fix hints for critical findings', () => {
  test('critical findings show a Fix: line in default mode', async () => {
    const output = await formatText(
      makeResult([
        makeFinding({
          severity: Severity.Critical,
          title: 'Missing Camera Usage Description',
          description: 'Camera framework used without NSCameraUsageDescription.',
          fixGuidance:
            'Add NSCameraUsageDescription to your Info.plist with a clear, user-facing explanation of why your app needs camera access.',
        }),
      ]),
      { version: '1.5.0' }
    );

    expect(output).toMatch(/Fix: Add NSCameraUsageDescription to your Info.plist/);
  });

  test('non-critical findings do NOT show a Fix: line', async () => {
    const output = await formatText(
      makeResult([
        makeFinding({
          severity: Severity.Medium,
          title: 'ATS exception for *.example.com',
          description: 'Needs written justification.',
          fixGuidance: 'Document why ATS must be relaxed for this domain.',
        }),
      ]),
      { version: '1.5.0' }
    );

    expect(output).not.toContain('Fix:');
  });

  test('verbose mode shows Fix: with piped content (not inline hint)', async () => {
    const output = await formatText(
      makeResult([
        makeFinding({
          severity: Severity.Critical,
          title: 'Missing Camera Usage Description',
          description: 'Camera framework used without NSCameraUsageDescription.',
          fixGuidance: 'Add NSCameraUsageDescription to your Info.plist.',
        }),
      ]),
      { verbose: true, version: '1.5.0' }
    );

    // verbose shows Fix: with piped content
    expect(output).toContain('Fix:');
    expect(output).toMatch(/│.*Add NSCameraUsageDescription/);
  });
});

describe('verbose nudge footer', () => {
  test('shows verbose nudge when there are findings', async () => {
    const output = await formatText(
      makeResult([makeFinding()]),
      { version: '1.5.0' }
    );

    expect(output).toContain('Run shiplint scan --verbose for details');
  });

  test('does NOT show verbose nudge when there are no findings', async () => {
    const output = await formatText(
      makeResult([]),
      { version: '1.5.0' }
    );

    expect(output).not.toContain('Run shiplint scan --verbose for details');
  });
});


describe('shortFixText on findings', () => {
  test('critical findings with shortFixText show it in Fix: line', async () => {
    const output = await formatText(
      makeResult([
        makeFinding({
          severity: Severity.Critical,
          title: 'Missing Camera Usage Description',
          description: 'Camera framework used without NSCameraUsageDescription.',
          fixGuidance: 'Add NSCameraUsageDescription to your Info.plist with a long explanation that would have been truncated before.',
          shortFixText: 'Add NSCameraUsageDescription to Info.plist explaining why your app needs camera access',
        }),
      ]),
      { version: '1.5.0' }
    );

    expect(output).toContain('Fix: Add NSCameraUsageDescription to Info.plist explaining why your app needs camera access');
    // Should NOT truncate or use fixGuidance text
    expect(output).not.toContain('...');
  });

  test('verbose mode shows thin dividers between findings', async () => {
    const output = await formatText(
      makeResult([
        makeFinding(),
        makeFinding({
          ruleId: 'config-001-ats-exception-without-justification',
          severity: Severity.Medium,
          title: 'ATS exception for *.example.com',
          description: 'Needs written justification.',
          fixGuidance: 'Document why ATS must be relaxed for this domain.',
          documentationURL: undefined,
        }),
      ]),
      { verbose: true, version: '1.5.0' }
    );

    expect(output).toContain('────────────────────────────────────────');
  });
});