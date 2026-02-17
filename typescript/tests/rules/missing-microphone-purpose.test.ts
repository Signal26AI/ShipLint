/**
 * Tests for MissingMicrophonePurposeRule
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MissingMicrophonePurposeRule } from '../../src/rules/privacy/missing-microphone-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingMicrophonePurposeRule', () => {
  const tempDirs: string[] = [];

  function createTempProject(swiftContent: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-microphone-'));
    const sourcePath = path.join(tempDir, 'Source.swift');
    fs.writeFileSync(sourcePath, swiftContent, 'utf-8');
    tempDirs.push(tempDir);
    return tempDir;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should return no findings when no audio framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should find missing NSMicrophoneUsageDescription when AVFAudio is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFAudio']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].ruleId).toBe('privacy-005-missing-microphone-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
  });

  it('should upgrade AVFoundation-only detection to critical when microphone APIs are found in source', async () => {
    const projectPath = createTempProject(`
      import AVFoundation
      final class RecorderController {
        var recorder: AVAudioRecorder?
      }
    `);

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should skip AVFoundation-only projects when only playback APIs are found', async () => {
    const projectPath = createTempProject(`
      import AVFoundation
      final class AudioPlayerController {
        let player: AVAudioPlayer?
      }
    `);

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should keep AVFoundation-only detection as high severity when source is ambiguous', async () => {
    const projectPath = createTempProject('import AVFoundation\n');

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
  });

  it('should find empty NSMicrophoneUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSMicrophoneUsageDescription: '',
      },
      {},
      new Set(['AVFAudio']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.title === 'Empty Microphone Usage Description')).toBe(true);
  });

  it('should find placeholder NSMicrophoneUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSMicrophoneUsageDescription: 'FIXME: add description',
      },
      {},
      new Set(['AVFAudio']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings.some((f) => f.title === 'Placeholder Microphone Usage Description')).toBe(true);
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSMicrophoneUsageDescription: 'We need microphone access to record voice messages.',
      },
      {},
      new Set(['AVFAudio']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should detect Speech framework and check for both mic and speech descriptions', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Speech']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    // Should find both missing microphone and speech recognition descriptions
    expect(findings.length).toBeGreaterThanOrEqual(2);
    expect(findings.some((f) => f.title === 'Missing Speech Recognition Usage Description')).toBe(true);
    expect(findings.some((f) => f.title === 'Missing Microphone Usage Description')).toBe(true);
  });

  it('should detect AVFoundation as potential microphone user with downgraded severity', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    // No source files = can't determine usage = warn
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.Medium);
  });

  it('should return no findings for AVFoundation when valid mic description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSMicrophoneUsageDescription: 'Record audio for your videos.',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingMicrophonePurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });
});
