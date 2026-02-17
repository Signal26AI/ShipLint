/**
 * Tests for MissingCameraPurposeRule
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MissingCameraPurposeRule } from '../../src/rules/privacy/missing-camera-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingCameraPurposeRule', () => {
  const tempDirs: string[] = [];

  function createTempProject(swiftContent: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-camera-'));
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

  it('should return no findings when no camera framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should warn when AVFoundation linked but no source files found', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    // No source files = can't determine usage = warn
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
    expect(findings[0].confidence).toBe(Confidence.Medium);
  });

  it('should upgrade AVFoundation-only detection to critical when camera APIs are found in source', async () => {
    const projectPath = createTempProject(`
      import AVFoundation
      final class CameraController {
        let session = AVCaptureSession()
      }
    `);

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should skip AVFoundation-only projects when only playback APIs are found', async () => {
    const projectPath = createTempProject(`
      import AVFoundation
      final class PlayerController {
        let player: AVPlayer?
      }
    `);

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should warn Medium for AVFoundation-only when source only has import', async () => {
    const projectPath = createTempProject('import AVFoundation\n');

    const context = createContextObject(
      projectPath,
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.Medium);
  });

  it('should find empty NSCameraUsageDescription', async () => {
    const projectPath = createTempProject('import AVFoundation\nlet s = AVCaptureSession()');
    const context = createContextObject(
      projectPath,
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: '',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Camera Usage Description');
  });

  it('should find placeholder NSCameraUsageDescription', async () => {
    const projectPath = createTempProject('import AVFoundation\nlet s = AVCaptureSession()');
    const context = createContextObject(
      projectPath,
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: 'TODO: add real description',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Camera Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSCameraUsageDescription: 'We need camera access to take photos for your profile and to scan QR codes.',
      },
      {},
      new Set(['AVFoundation']),
      []
    );

    const findings = await MissingCameraPurposeRule.evaluate(context);

    expect(findings).toEqual([]);
  });

  it('should detect AVKit as camera framework', async () => {
    const contextAVKit = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['AVKit']),
      []
    );

    const findingsAVKit = await MissingCameraPurposeRule.evaluate(contextAVKit);

    expect(findingsAVKit).toHaveLength(1);
  });

  it('should NOT flag VisionKit alone (ImageAnalyzer does not require camera)', async () => {
    // VisionKit is used for Live Text (ImageAnalyzer) which doesn't need camera.
    // Only DataScannerViewController requires camera, but detecting that needs
    // deeper source analysis. Conservative approach: don't flag VisionKit alone.
    const contextVisionKit = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['VisionKit']),
      []
    );

    const findingsVisionKit = await MissingCameraPurposeRule.evaluate(contextVisionKit);

    expect(findingsVisionKit).toHaveLength(0);
  });
});
