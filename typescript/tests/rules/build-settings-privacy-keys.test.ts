/**
 * Tests for generic INFOPLIST_KEY_* build settings support
 * 
 * When GENERATE_INFOPLIST_FILE = YES, ALL INFOPLIST_KEY_* build settings
 * should be treated as equivalent Info.plist keys (strip the prefix).
 */
import { MissingCameraPurposeRule } from '../../src/rules/privacy/missing-camera-purpose';
import { MissingPhotoLibraryPurposeRule } from '../../src/rules/privacy/missing-photo-library-purpose';
import { MissingMicrophonePurposeRule } from '../../src/rules/privacy/missing-microphone-purpose';
import { MissingFaceIdPurposeRule } from '../../src/rules/privacy/missing-face-id-purpose';
import { createContextObject } from '../../src/parsers/project-parser';

function createGeneratedPlistContext(
  buildSettings: Record<string, string>,
  frameworks: string[] = [],
  infoPlist: Record<string, unknown> = {}
) {
  return createContextObject(
    '/test/project',
    infoPlist,
    {},
    new Set<string>(frameworks),
    [],
    undefined,
    undefined,
    '/test/project/MyApp.xcodeproj/project.pbxproj',
    { GENERATE_INFOPLIST_FILE: 'YES', ...buildSettings }
  );
}

describe('Privacy keys via INFOPLIST_KEY_* build settings', () => {
  describe('NSCameraUsageDescription via build settings', () => {
    it('should NOT flag when camera description set via INFOPLIST_KEY_NSCameraUsageDescription', async () => {
      const context = createGeneratedPlistContext(
        { INFOPLIST_KEY_NSCameraUsageDescription: 'We need camera access to take photos for your profile' },
        ['AVFoundation']
      );
      const findings = await MissingCameraPurposeRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should flag when camera framework used but no build setting or plist key', async () => {
      const context = createGeneratedPlistContext({}, ['AVFoundation']);
      const findings = await MissingCameraPurposeRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('privacy-001-missing-camera-purpose');
    });
  });

  describe('NSPhotoLibraryUsageDescription via build settings', () => {
    it('should NOT flag when photo library description set via build setting', async () => {
      const context = createGeneratedPlistContext(
        { INFOPLIST_KEY_NSPhotoLibraryUsageDescription: 'We need photo library access to save and share your images' },
        ['PhotosUI']
      );
      const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should flag when photo framework used but no build setting', async () => {
      const context = createGeneratedPlistContext({}, ['PhotosUI']);
      const findings = await MissingPhotoLibraryPurposeRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });
  });

  describe('NSMicrophoneUsageDescription via build settings', () => {
    it('should NOT flag when microphone description set via build setting', async () => {
      const context = createGeneratedPlistContext(
        { INFOPLIST_KEY_NSMicrophoneUsageDescription: 'We need microphone access to record audio messages for your conversations' },
        ['AVFoundation']
      );
      const findings = await MissingMicrophonePurposeRule.evaluate(context);
      expect(findings).toEqual([]);
    });
  });

  describe('NSFaceIDUsageDescription via build settings', () => {
    it('should NOT flag when Face ID description set via build setting', async () => {
      const context = createGeneratedPlistContext(
        { INFOPLIST_KEY_NSFaceIDUsageDescription: 'We use Face ID to securely authenticate your identity' },
        ['LocalAuthentication']
      );
      const findings = await MissingFaceIdPurposeRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should flag when LocalAuthentication used but no build setting', async () => {
      const context = createGeneratedPlistContext({}, ['LocalAuthentication']);
      const findings = await MissingFaceIdPurposeRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });
  });

  describe('Source plist takes precedence over build settings', () => {
    it('should use source plist value when both exist', async () => {
      const context = createGeneratedPlistContext(
        { INFOPLIST_KEY_NSCameraUsageDescription: 'Build setting value for camera access in the application' },
        ['AVFoundation'],
        { NSCameraUsageDescription: 'We need camera access to scan documents for your account' }
      );
      // Should not flag - plist has value
      const findings = await MissingCameraPurposeRule.evaluate(context);
      expect(findings).toEqual([]);
      // Verify plist value is returned (not build setting)
      expect(context.plistString('NSCameraUsageDescription')).toBe('We need camera access to scan documents for your account');
    });
  });

  describe('Build settings only apply when GENERATE_INFOPLIST_FILE=YES', () => {
    it('should NOT use build settings when GENERATE_INFOPLIST_FILE is not set', async () => {
      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set<string>(['AVFoundation']),
        [],
        undefined,
        undefined,
        '/test/project/MyApp.xcodeproj/project.pbxproj',
        { INFOPLIST_KEY_NSCameraUsageDescription: 'We need camera access to take photos for your profile' } // no GENERATE_INFOPLIST_FILE
      );
      const findings = await MissingCameraPurposeRule.evaluate(context);
      expect(findings).toHaveLength(1); // Should still flag
    });
  });
});
