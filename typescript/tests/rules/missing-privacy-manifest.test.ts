/**
 * Tests for MissingPrivacyManifestRule
 */
import { MissingPrivacyManifestRule } from '../../src/rules/metadata/missing-privacy-manifest';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence, DependencySource } from '../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('MissingPrivacyManifestRule', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readdirSync.mockReturnValue([]);
    mockFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);
  });

  it('should return no findings when privacy manifest exists', async () => {
    mockFs.existsSync.mockImplementation((p) => {
      return (p as string).includes('PrivacyInfo.xcprivacy');
    });

    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'Firebase', version: '10.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing privacy manifest when Firebase SDK is used', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'Firebase', version: '10.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].ruleId).toBe('metadata-001-missing-privacy-manifest');
    expect(findings[0].title).toBe('Missing Privacy Manifest for Third-Party SDKs');
  });

  it('should find missing privacy manifest when Facebook SDK is used', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'FBSDKCoreKit', version: '16.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].description).toContain('Facebook SDK');
  });

  it('should find missing privacy manifest when Google Mobile Ads is used', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'Google-Mobile-Ads-SDK', version: '10.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].description).toContain('Google Mobile Ads');
  });

  it('should detect multiple SDKs requiring privacy manifest', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [
        { name: 'Firebase', version: '10.0.0', source: DependencySource.CocoaPods },
        { name: 'Amplitude', version: '8.0.0', source: DependencySource.CocoaPods },
        { name: 'Mixpanel', version: '4.0.0', source: DependencySource.CocoaPods },
      ]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].description).toContain('Firebase');
    expect(findings[0].description).toContain('Amplitude');
    expect(findings[0].description).toContain('Mixpanel');
  });

  it('should return info-level finding for projects with dependencies but no known SDK', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation', 'UIKit']),
      [{ name: 'SomeUnknownLib', version: '1.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    // Should get an informational finding about considering privacy manifest
    expect(findings.length).toBeLessThanOrEqual(1);
    if (findings.length > 0) {
      expect(findings[0].severity).toBe(Severity.Info);
    }
  });

  it('should detect AppsFlyer SDK', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'AppsFlyerFramework', version: '6.0.0', source: DependencySource.CocoaPods }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].description).toContain('AppsFlyer');
  });

  it('should detect Adjust SDK', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Foundation']),
      [{ name: 'Adjust', version: '4.0.0', source: DependencySource.SPM }]
    );

    const findings = await MissingPrivacyManifestRule.evaluate(context);
    
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].description).toContain('Adjust');
  });
});
