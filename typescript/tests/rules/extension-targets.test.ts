/**
 * Tests for app extension detection
 * 
 * App extensions should NOT be flagged for app-level rules:
 * - config-003: Missing launch storyboard
 * - metadata-002: Missing orientations
 * - config-002: Missing export compliance
 */
import { MissingLaunchStoryboardRule } from '../../src/rules/config/missing-launch-storyboard';
import { MissingSupportedOrientationsRule } from '../../src/rules/metadata/missing-supported-orientations';
import { MissingEncryptionFlagRule } from '../../src/rules/config/missing-encryption-flag';
import { createContextObject } from '../../src/parsers/project-parser';

function createExtensionContext(
  extensionType: 'plist-NSExtension' | 'plist-NSExtensionPointIdentifier' | 'build-setting',
  extraPlist: Record<string, unknown> = {},
  extraBuildSettings: Record<string, string> = {}
) {
  const plist: Record<string, unknown> = { ...extraPlist };
  const buildSettings: Record<string, string> = { ...extraBuildSettings };

  if (extensionType === 'plist-NSExtension') {
    plist['NSExtension'] = {
      NSExtensionPointIdentifier: 'com.apple.widgetkit-extension',
      NSExtensionPrincipalClass: '$(PRODUCT_MODULE_NAME).WidgetProvider',
    };
  } else if (extensionType === 'plist-NSExtensionPointIdentifier') {
    plist['NSExtensionPointIdentifier'] = 'com.apple.share-services';
  } else if (extensionType === 'build-setting') {
    buildSettings['PRODUCT_TYPE'] = 'com.apple.product-type.app-extension';
  }

  return createContextObject(
    '/test/project',
    plist,
    {},
    new Set<string>(),
    [],
    undefined,
    undefined,
    '/test/project/MyApp.xcodeproj/project.pbxproj',
    buildSettings
  );
}

describe('Extension targets skip app-level rules', () => {
  const appLevelRules = [
    { name: 'config-003 (launch storyboard)', rule: MissingLaunchStoryboardRule },
    { name: 'metadata-002 (orientations)', rule: MissingSupportedOrientationsRule },
    { name: 'config-002 (encryption flag)', rule: MissingEncryptionFlagRule },
  ];

  describe('Extension detected via NSExtension in Info.plist', () => {
    for (const { name, rule } of appLevelRules) {
      it(`should NOT flag ${name} for widget extension`, async () => {
        const context = createExtensionContext('plist-NSExtension');
        const findings = await rule.evaluate(context);
        expect(findings).toEqual([]);
      });
    }
  });

  describe('Extension detected via NSExtensionPointIdentifier in Info.plist', () => {
    for (const { name, rule } of appLevelRules) {
      it(`should NOT flag ${name} for share extension`, async () => {
        const context = createExtensionContext('plist-NSExtensionPointIdentifier');
        const findings = await rule.evaluate(context);
        expect(findings).toEqual([]);
      });
    }
  });

  describe('Extension detected via PRODUCT_TYPE build setting', () => {
    for (const { name, rule } of appLevelRules) {
      it(`should NOT flag ${name} when product type is app-extension`, async () => {
        const context = createExtensionContext('build-setting');
        const findings = await rule.evaluate(context);
        expect(findings).toEqual([]);
      });
    }
  });

  describe('Non-extension targets still flagged', () => {
    it('should still flag missing launch storyboard for regular app', async () => {
      const context = createContextObject('/test', {}, {}, new Set(), []);
      const findings = await MissingLaunchStoryboardRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });

    it('should still flag missing orientations for regular app', async () => {
      const context = createContextObject('/test', {}, {}, new Set(), []);
      const findings = await MissingSupportedOrientationsRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });

    it('should still flag missing encryption for regular app', async () => {
      const context = createContextObject('/test', {}, {}, new Set(), []);
      const findings = await MissingEncryptionFlagRule.evaluate(context);
      expect(findings).toHaveLength(1);
    });
  });

  describe('isExtension() helper', () => {
    it('returns true for NSExtension in plist', () => {
      const context = createExtensionContext('plist-NSExtension');
      expect(context.isExtension()).toBe(true);
    });

    it('returns true for NSExtensionPointIdentifier in plist', () => {
      const context = createExtensionContext('plist-NSExtensionPointIdentifier');
      expect(context.isExtension()).toBe(true);
    });

    it('returns true for app-extension product type', () => {
      const context = createExtensionContext('build-setting');
      expect(context.isExtension()).toBe(true);
    });

    it('returns false for regular app', () => {
      const context = createContextObject('/test', {}, {}, new Set(), []);
      expect(context.isExtension()).toBe(false);
    });
  });
});
