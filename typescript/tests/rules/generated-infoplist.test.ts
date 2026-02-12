/**
 * Tests for generated Info.plist support (GENERATE_INFOPLIST_FILE = YES)
 * 
 * Modern Xcode 14+ SwiftUI projects use GENERATE_INFOPLIST_FILE = YES
 * and set plist keys via INFOPLIST_KEY_* build settings instead of a
 * source Info.plist file. These tests verify that rules correctly check
 * build settings as an alternative source of truth.
 */
import { MissingLaunchStoryboardRule } from '../../src/rules/config/missing-launch-storyboard';
import { MissingSupportedOrientationsRule } from '../../src/rules/metadata/missing-supported-orientations';
import { MissingEncryptionFlagRule } from '../../src/rules/config/missing-encryption-flag';
import { createContextObject } from '../../src/parsers/project-parser';

/**
 * Helper to create a context simulating a modern SwiftUI project with
 * GENERATE_INFOPLIST_FILE = YES and no source Info.plist keys.
 */
function createGeneratedPlistContext(buildSettings: Record<string, string>) {
  return createContextObject(
    '/test/project',
    {}, // empty Info.plist (no source plist)
    {},
    new Set<string>(),
    [],
    undefined,
    undefined,
    '/test/project/MyApp.xcodeproj/project.pbxproj',
    { GENERATE_INFOPLIST_FILE: 'YES', ...buildSettings }
  );
}

describe('Generated Info.plist support', () => {
  describe('config-003-missing-launch-storyboard', () => {
    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and INFOPLIST_KEY_UILaunchScreen_Generation=YES', async () => {
      const context = createGeneratedPlistContext({
        INFOPLIST_KEY_UILaunchScreen_Generation: 'YES',
      });
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and INFOPLIST_KEY_UILaunchStoryboardName is set', async () => {
      const context = createGeneratedPlistContext({
        INFOPLIST_KEY_UILaunchStoryboardName: 'LaunchScreen',
      });
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should NOT flag when UILaunchScreen dict is present in source plist', async () => {
      const context = createContextObject(
        '/test/project',
        { UILaunchScreen: {} }, // dict-based launch screen config
        {},
        new Set<string>(),
        [],
      );
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should still flag when GENERATE_INFOPLIST_FILE=YES but no launch screen build setting', async () => {
      const context = createGeneratedPlistContext({});
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('config-003-missing-launch-storyboard');
    });

    it('should still flag when no generated plist and no source plist key', async () => {
      const context = createContextObject(
        '/test/project',
        {},
        {},
        new Set<string>(),
        [],
      );
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });
  });

  describe('metadata-002-missing-supported-orientations', () => {
    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and iPhone orientations set', async () => {
      const context = createGeneratedPlistContext({
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone': 'UIInterfaceOrientationPortrait',
      });
      const findings = await MissingSupportedOrientationsRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and iPad orientations set', async () => {
      const context = createGeneratedPlistContext({
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad': 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft',
      });
      const findings = await MissingSupportedOrientationsRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and generic orientations set', async () => {
      const context = createGeneratedPlistContext({
        'INFOPLIST_KEY_UISupportedInterfaceOrientations': 'UIInterfaceOrientationPortrait',
      });
      const findings = await MissingSupportedOrientationsRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should still flag when GENERATE_INFOPLIST_FILE=YES but no orientation build settings', async () => {
      const context = createGeneratedPlistContext({});
      const findings = await MissingSupportedOrientationsRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('metadata-002-missing-supported-orientations');
    });
  });

  describe('config-002-missing-encryption-flag', () => {
    it('should NOT flag when GENERATE_INFOPLIST_FILE=YES and encryption build setting set', async () => {
      const context = createGeneratedPlistContext({
        INFOPLIST_KEY_ITSAppUsesNonExemptEncryption: 'NO',
      });
      const findings = await MissingEncryptionFlagRule.evaluate(context);
      expect(findings).toEqual([]);
    });

    it('should still flag when GENERATE_INFOPLIST_FILE=YES but no encryption build setting', async () => {
      const context = createGeneratedPlistContext({});
      const findings = await MissingEncryptionFlagRule.evaluate(context);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('config-002-missing-encryption-flag');
    });
  });

  describe('Fresh SwiftUI project simulation', () => {
    it('should produce NO false positives for a typical Xcode 14+ SwiftUI project', async () => {
      // Simulates what Xcode generates for a new SwiftUI project
      const context = createGeneratedPlistContext({
        INFOPLIST_KEY_UILaunchScreen_Generation: 'YES',
        'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone': 'UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight',
      });

      const launchFindings = await MissingLaunchStoryboardRule.evaluate(context);
      const orientationFindings = await MissingSupportedOrientationsRule.evaluate(context);

      expect(launchFindings).toEqual([]);
      expect(orientationFindings).toEqual([]);
    });
  });

  describe('ScanContext build settings helpers', () => {
    it('generatesInfoPlist() returns true when GENERATE_INFOPLIST_FILE=YES', () => {
      const context = createGeneratedPlistContext({});
      expect(context.generatesInfoPlist()).toBe(true);
    });

    it('generatesInfoPlist() returns false when not set', () => {
      const context = createContextObject('/test', {}, {}, new Set(), []);
      expect(context.generatesInfoPlist()).toBe(false);
    });

    it('hasBuildSetting() works correctly', () => {
      const context = createGeneratedPlistContext({ FOO: 'bar' });
      expect(context.hasBuildSetting('FOO')).toBe(true);
      expect(context.hasBuildSetting('BAZ')).toBe(false);
    });

    it('buildSettingValue() returns correct values', () => {
      const context = createGeneratedPlistContext({ FOO: 'bar' });
      expect(context.buildSettingValue('FOO')).toBe('bar');
      expect(context.buildSettingValue('BAZ')).toBeUndefined();
    });
  });
});
