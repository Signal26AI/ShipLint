/**
 * Tests for project-parser.ts
 * Covers bug fixes for xcodeproj path handling and recursive discovery
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { discoverProject } from '../../src/parsers/project-parser';

describe('discoverProject', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Bug Fix #1: Direct .xcodeproj path handling', () => {
    it('should find pbxproj when .xcodeproj is passed directly', () => {
      // Create structure: MyApp.xcodeproj/project.pbxproj
      const xcodeprojDir = path.join(tempDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir);
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// pbxproj content');

      // Pass the .xcodeproj path directly (the bug scenario)
      const discovery = discoverProject(xcodeprojDir);

      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
      expect(discovery.projectPath).toBe(tempDir);
    });

    it('should find Info.plist in parent when .xcodeproj is passed directly', () => {
      // Create structure:
      // - MyApp.xcodeproj/project.pbxproj
      // - Info.plist (in parent)
      const xcodeprojDir = path.join(tempDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir);
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// pbxproj content');
      fs.writeFileSync(path.join(tempDir, 'Info.plist'), '<?xml version="1.0"?>');

      const discovery = discoverProject(xcodeprojDir);

      expect(discovery.pbxprojPath).toBeDefined();
      expect(discovery.infoPlistPath).toBe(path.join(tempDir, 'Info.plist'));
    });

    it('should handle .xcworkspace passed directly', () => {
      // Create structure:
      // - MyApp.xcworkspace/ (empty dir is fine for this test)
      // - MyApp.xcodeproj/project.pbxproj
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      const xcodeprojDir = path.join(tempDir, 'MyApp.xcodeproj');
      fs.mkdirSync(workspaceDir);
      fs.mkdirSync(xcodeprojDir);
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// pbxproj content');

      const discovery = discoverProject(workspaceDir);

      expect(discovery.isWorkspace).toBe(true);
      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
    });
  });

  describe('Bug Fix #3: Recursive project discovery', () => {
    it('should find .xcodeproj in nested directories', () => {
      // Create structure: subdir/nested/MyApp.xcodeproj/project.pbxproj
      const nestedDir = path.join(tempDir, 'subdir', 'nested');
      const xcodeprojDir = path.join(nestedDir, 'MyApp.xcodeproj');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.mkdirSync(xcodeprojDir);
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// pbxproj content');

      const discovery = discoverProject(tempDir);

      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
    });

    it('should find Info.plist in nested directories', () => {
      // Create structure: ios/MyApp/Info.plist (common monorepo structure)
      const iosDir = path.join(tempDir, 'ios', 'MyApp');
      fs.mkdirSync(iosDir, { recursive: true });
      fs.writeFileSync(path.join(iosDir, 'Info.plist'), '<?xml version="1.0"?>');

      const discovery = discoverProject(tempDir);

      expect(discovery.infoPlistPath).toBe(path.join(iosDir, 'Info.plist'));
    });

    it('should find entitlements in nested directories', () => {
      // Create structure: ios/MyApp/MyApp.entitlements
      const iosDir = path.join(tempDir, 'ios', 'MyApp');
      fs.mkdirSync(iosDir, { recursive: true });
      fs.writeFileSync(path.join(iosDir, 'MyApp.entitlements'), '<?xml version="1.0"?>');

      const discovery = discoverProject(tempDir);

      expect(discovery.entitlementsPath).toBe(path.join(iosDir, 'MyApp.entitlements'));
    });

    it('should prefer shallower paths when multiple matches exist', () => {
      // Create Info.plist at root and in nested dir
      // Root should be preferred
      fs.writeFileSync(path.join(tempDir, 'Info.plist'), '<?xml version="1.0"?><root/>');
      const nestedDir = path.join(tempDir, 'ios', 'app');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'Info.plist'), '<?xml version="1.0"?><nested/>');

      const discovery = discoverProject(tempDir);

      expect(discovery.infoPlistPath).toBe(path.join(tempDir, 'Info.plist'));
    });

    it('should skip node_modules and other non-project directories', () => {
      // Create .xcodeproj in node_modules (should be ignored)
      const nodeModulesXcode = path.join(tempDir, 'node_modules', 'some-pkg', 'Example.xcodeproj');
      fs.mkdirSync(nodeModulesXcode, { recursive: true });
      fs.writeFileSync(path.join(nodeModulesXcode, 'project.pbxproj'), '// should be ignored');

      // Create actual project
      const realXcode = path.join(tempDir, 'ios', 'MyApp.xcodeproj');
      fs.mkdirSync(realXcode, { recursive: true });
      fs.writeFileSync(path.join(realXcode, 'project.pbxproj'), '// real project');

      const discovery = discoverProject(tempDir);

      expect(discovery.pbxprojPath).toBe(path.join(realXcode, 'project.pbxproj'));
    });

    it('should handle deep monorepo structures (up to 5 levels)', () => {
      // Create structure: packages/mobile/apps/ios/MyApp.xcodeproj/project.pbxproj
      const deepDir = path.join(tempDir, 'packages', 'mobile', 'apps', 'ios');
      const xcodeprojDir = path.join(deepDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// deep project');

      const discovery = discoverProject(tempDir);

      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
    });
  });

  describe('Edge cases', () => {
    it('should throw on IPA file input', () => {
      const ipaPath = path.join(tempDir, 'MyApp.ipa');
      fs.writeFileSync(ipaPath, 'not a real ipa');

      expect(() => discoverProject(ipaPath)).toThrow('IPA scanning is not yet supported');
    });

    it('should handle empty directory gracefully', () => {
      const discovery = discoverProject(tempDir);

      expect(discovery.projectPath).toBe(tempDir);
      expect(discovery.pbxprojPath).toBeUndefined();
      expect(discovery.infoPlistPath).toBeUndefined();
      expect(discovery.entitlementsPath).toBeUndefined();
    });
  });
});
