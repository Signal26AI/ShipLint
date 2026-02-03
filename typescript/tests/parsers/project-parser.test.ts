/**
 * Tests for project-parser.ts
 * Covers bug fixes for xcodeproj path handling and recursive discovery
 * P1/P2: Tests for workspace parsing and pbxproj artifact extraction
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { discoverProject, parsePbxprojForArtifacts } from '../../src/parsers/project-parser';

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

  describe('P1 Fix: .xcworkspace depth too shallow', () => {
    it('should find .xcodeproj at depth 3 within workspace', () => {
      // Create structure:
      // MyApp.xcworkspace/
      //   contents.xcworkspacedata
      // MyApp/
      //   Sources/
      //   MyApp.xcodeproj/   <- depth 3, was missed before!
      //     project.pbxproj
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), '<?xml version="1.0"?>');
      
      const nestedDir = path.join(tempDir, 'MyApp', 'Sources');
      const xcodeprojDir = path.join(tempDir, 'MyApp', 'MyApp.xcodeproj');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.mkdirSync(xcodeprojDir);
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// nested project');

      // Pass the workspace path
      const discovery = discoverProject(workspaceDir);

      expect(discovery.isWorkspace).toBe(true);
      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
    });

    it('should find .xcodeproj at depth 4 within workspace', () => {
      // Create structure:
      // MyApp.xcworkspace/
      // packages/ios/MyApp/MyApp.xcodeproj/  <- depth 4
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const xcodeprojDir = path.join(tempDir, 'packages', 'ios', 'MyApp', 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// deep nested project');

      const discovery = discoverProject(workspaceDir);

      expect(discovery.isWorkspace).toBe(true);
      expect(discovery.pbxprojPath).toBe(path.join(xcodeprojDir, 'project.pbxproj'));
    });
  });

  describe('P2 Fix: Monorepo artifact scoping', () => {
    it('should scope Info.plist to project directory, not pick globally shallowest', () => {
      // Create monorepo structure:
      // monorepo/
      //   AppA/
      //     AppA.xcodeproj/project.pbxproj
      //     Info.plist          <- AppA's plist
      //   AppB/
      //     AppB.xcodeproj/project.pbxproj
      //     Info.plist          <- AppB's plist (should be picked when scanning AppB)
      
      // Create AppA
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA project');
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.test.AppA</string></dict></plist>');
      
      // Create AppB (nested deeper so it appears later in scan order)
      const appBDir = path.join(tempDir, 'AppB', 'ios');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB project');
      fs.writeFileSync(path.join(appBDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.test.AppB</string></dict></plist>');
      
      // When scanning from AppB's xcodeproj directly, it should find AppB's Info.plist
      const discovery = discoverProject(appBXcode);
      
      expect(discovery.pbxprojPath).toBe(path.join(appBXcode, 'project.pbxproj'));
      expect(discovery.infoPlistPath).toBe(path.join(appBDir, 'Info.plist'));
      // projectScopeDir should be set to AppB's directory
      expect(discovery.projectScopeDir).toBe(appBDir);
    });

    it('should scope entitlements to project directory in monorepo', () => {
      // Create AppA and AppB with different entitlements
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
      fs.writeFileSync(path.join(appADir, 'AppA.entitlements'), '<?xml version="1.0"?><dict><key>keychain-access-groups</key></dict>');
      
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
      fs.writeFileSync(path.join(appBDir, 'AppB.entitlements'), '<?xml version="1.0"?><dict><key>aps-environment</key></dict>');
      
      // Scan from AppB's project - should get AppB's entitlements
      const discovery = discoverProject(appBXcode);
      
      expect(discovery.entitlementsPath).toBe(path.join(appBDir, 'AppB.entitlements'));
    });

    it('should pick first xcodeproj and scope artifacts when scanning monorepo root', () => {
      // When scanning from monorepo root, it picks the first xcodeproj found
      // and scopes artifacts to that project's directory
      
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>A</string></dict></plist>');
      
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
      fs.writeFileSync(path.join(appBDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>B</string></dict></plist>');
      
      // Scan from root - will pick first xcodeproj (alphabetical: AppA)
      const discovery = discoverProject(tempDir);
      
      // Should scope to AppA's directory
      expect(discovery.projectScopeDir).toBe(appADir);
      expect(discovery.infoPlistPath).toBe(path.join(appADir, 'Info.plist'));
    });

    it('should handle workspace in monorepo with correct scoping', () => {
      // Monorepo structure:
      // MyMonorepo.xcworkspace/
      // packages/
      //   AppA/
      //     AppA.xcodeproj/project.pbxproj
      //     Info.plist
      //   AppB/
      //     AppB.xcodeproj/project.pbxproj
      //     Info.plist
      
      const workspaceDir = path.join(tempDir, 'MyMonorepo.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const appADir = path.join(tempDir, 'packages', 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>A</string></dict></plist>');
      
      const appBDir = path.join(tempDir, 'packages', 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
      fs.writeFileSync(path.join(appBDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>B</string></dict></plist>');
      
      // Scan from workspace - picks first project and scopes correctly
      const discovery = discoverProject(workspaceDir);
      
      expect(discovery.isWorkspace).toBe(true);
      expect(discovery.projectScopeDir).toBeDefined();
      // The Info.plist should be from the same directory as the selected xcodeproj
      const scopeDir = discovery.projectScopeDir!;
      expect(discovery.infoPlistPath).toBe(path.join(scopeDir, 'Info.plist'));
    });
  });

  describe('P2 Fix: Parse pbxproj for explicit artifact paths', () => {
    it('should extract INFOPLIST_FILE from pbxproj', () => {
      // Create project structure
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // Create Info.plist in nested location
      const plistDir = path.join(projectDir, 'Sources', 'MyApp');
      fs.mkdirSync(plistDir, { recursive: true });
      fs.writeFileSync(path.join(plistDir, 'Info.plist'), '<?xml version="1.0"?><plist></plist>');
      
      // Create pbxproj with INFOPLIST_FILE setting
      const pbxprojContent = `
// !$*UTF8*$!
{
  archiveVersion = 1;
  objectVersion = 56;
  objects = {
    /* Build configuration */
    DEADBEEF /* Debug */ = {
      isa = XCBuildConfiguration;
      buildSettings = {
        INFOPLIST_FILE = "Sources/MyApp/Info.plist";
        PRODUCT_NAME = "$(TARGET_NAME)";
      };
      name = Debug;
    };
  };
}`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      const artifacts = parsePbxprojForArtifacts(
        path.join(xcodeprojDir, 'project.pbxproj'),
        projectDir
      );
      
      expect(artifacts.infoPlistPath).toBe(path.join(plistDir, 'Info.plist'));
    });

    it('should extract CODE_SIGN_ENTITLEMENTS from pbxproj', () => {
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // Create entitlements file
      fs.writeFileSync(path.join(projectDir, 'MyApp.entitlements'), '<?xml version="1.0"?>');
      
      const pbxprojContent = `
// !$*UTF8*$!
{
  buildSettings = {
    CODE_SIGN_ENTITLEMENTS = "MyApp.entitlements";
    INFOPLIST_FILE = "Info.plist";
  };
}`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      const artifacts = parsePbxprojForArtifacts(
        path.join(xcodeprojDir, 'project.pbxproj'),
        projectDir
      );
      
      expect(artifacts.entitlementsPath).toBe(path.join(projectDir, 'MyApp.entitlements'));
    });

    it('should handle INFOPLIST_FILE without quotes', () => {
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      fs.writeFileSync(path.join(projectDir, 'Info.plist'), '<?xml version="1.0"?>');
      
      const pbxprojContent = `
buildSettings = {
  INFOPLIST_FILE = MyApp/Info.plist;
};`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      // Create the nested directory and file
      fs.mkdirSync(path.join(projectDir, 'MyApp'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'MyApp', 'Info.plist'), '<?xml version="1.0"?>');
      
      const artifacts = parsePbxprojForArtifacts(
        path.join(xcodeprojDir, 'project.pbxproj'),
        projectDir
      );
      
      expect(artifacts.infoPlistPath).toBe(path.join(projectDir, 'MyApp', 'Info.plist'));
    });

    it('should handle $(SRCROOT) prefix in paths', () => {
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      fs.writeFileSync(path.join(projectDir, 'Info.plist'), '<?xml version="1.0"?>');
      
      const pbxprojContent = `
buildSettings = {
  INFOPLIST_FILE = "$(SRCROOT)/Info.plist";
};`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      const artifacts = parsePbxprojForArtifacts(
        path.join(xcodeprojDir, 'project.pbxproj'),
        projectDir
      );
      
      expect(artifacts.infoPlistPath).toBe(path.join(projectDir, 'Info.plist'));
    });

    it('should return empty result for non-existent pbxproj', () => {
      const artifacts = parsePbxprojForArtifacts(
        '/nonexistent/project.pbxproj',
        '/nonexistent'
      );
      
      expect(artifacts.infoPlistPath).toBeUndefined();
      expect(artifacts.entitlementsPath).toBeUndefined();
    });

    it('should return empty result when artifact files do not exist', () => {
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // pbxproj references files that don't exist
      const pbxprojContent = `
buildSettings = {
  INFOPLIST_FILE = "NonExistent/Info.plist";
  CODE_SIGN_ENTITLEMENTS = "NonExistent.entitlements";
};`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      const artifacts = parsePbxprojForArtifacts(
        path.join(xcodeprojDir, 'project.pbxproj'),
        projectDir
      );
      
      // Should return undefined for non-existent files
      expect(artifacts.infoPlistPath).toBeUndefined();
      expect(artifacts.entitlementsPath).toBeUndefined();
    });

    it('should integrate pbxproj parsing in discoverProject', () => {
      // Create project with pbxproj that specifies Info.plist path
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // Create Info.plist in nested location (not root)
      const nestedDir = path.join(projectDir, 'Configs', 'Debug');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'Info.plist'), '<?xml version="1.0"?><plist></plist>');
      
      // Also create a decoy Info.plist at root (should NOT be picked)
      fs.writeFileSync(path.join(projectDir, 'Info.plist'), '<?xml version="1.0"?><plist><wrong/></plist>');
      
      // pbxproj specifies the nested path
      const pbxprojContent = `
buildSettings = {
  INFOPLIST_FILE = "Configs/Debug/Info.plist";
};`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      const discovery = discoverProject(xcodeprojDir);
      
      // Should use the explicitly specified path, not the root one
      expect(discovery.infoPlistPath).toBe(path.join(nestedDir, 'Info.plist'));
    });

    it('should fall back to directory search when pbxproj has no artifact paths', () => {
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      
      // pbxproj without INFOPLIST_FILE
      const pbxprojContent = `
buildSettings = {
  PRODUCT_NAME = "MyApp";
};`;
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);
      
      // Create Info.plist that should be found by directory search
      fs.writeFileSync(path.join(projectDir, 'Info.plist'), '<?xml version="1.0"?>');
      
      const discovery = discoverProject(xcodeprojDir);
      
      // Should fall back to directory search
      expect(discovery.infoPlistPath).toBe(path.join(projectDir, 'Info.plist'));
    });
  });

  describe('P1 Fix: Parse workspace data for project references', () => {
    it('should use workspace data to find correct project', () => {
      // Create workspace with contents.xcworkspacedata
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      // Create main project
      const mainProjectDir = path.join(tempDir, 'MyApp');
      const mainXcodeproj = path.join(mainProjectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(mainXcodeproj, { recursive: true });
      fs.writeFileSync(path.join(mainXcodeproj, 'project.pbxproj'), '// main');
      fs.writeFileSync(path.join(mainProjectDir, 'Info.plist'), '<?xml version="1.0"?><main/>');
      
      // Create Pods project (should be skipped)
      const podsDir = path.join(tempDir, 'Pods');
      const podsXcodeproj = path.join(podsDir, 'Pods.xcodeproj');
      fs.mkdirSync(podsXcodeproj, { recursive: true });
      fs.writeFileSync(path.join(podsXcodeproj, 'project.pbxproj'), '// pods');
      fs.writeFileSync(path.join(podsDir, 'Info.plist'), '<?xml version="1.0"?><pods/>');
      
      // Workspace data references both projects
      const workspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`;
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), workspaceData);
      
      const discovery = discoverProject(workspaceDir);
      
      // Should find the main project, not Pods
      expect(discovery.pbxprojPath).toBe(path.join(mainXcodeproj, 'project.pbxproj'));
      expect(discovery.workspaceProjects).toBeDefined();
      expect(discovery.workspaceProjects!.length).toBe(1); // Only main project, not Pods
      expect(discovery.workspaceProjects![0]).toBe(mainXcodeproj);
    });

    it('should handle workspace with nested project structure', () => {
      // Workspace references a project in a subdirectory
      const workspaceDir = path.join(tempDir, 'MyWorkspace.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      // Create nested project
      const nestedProjectDir = path.join(tempDir, 'packages', 'ios', 'MyApp');
      const nestedXcodeproj = path.join(nestedProjectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(nestedXcodeproj, { recursive: true });
      fs.writeFileSync(path.join(nestedXcodeproj, 'project.pbxproj'), '// nested');
      fs.writeFileSync(path.join(nestedProjectDir, 'Info.plist'), '<?xml version="1.0"?>');
      
      // Workspace data references the nested project
      const workspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:packages/ios/MyApp/MyApp.xcodeproj"/>
</Workspace>`;
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), workspaceData);
      
      const discovery = discoverProject(workspaceDir);
      
      expect(discovery.pbxprojPath).toBe(path.join(nestedXcodeproj, 'project.pbxproj'));
      expect(discovery.projectScopeDir).toBe(nestedProjectDir);
      expect(discovery.infoPlistPath).toBe(path.join(nestedProjectDir, 'Info.plist'));
    });

    it('should skip Pods in workspace and use correct scoping', () => {
      // This tests the specific issue: workspace contains multiple projects,
      // we should pick the right one and scope artifacts correctly
      
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      // Main app project with nested Info.plist
      const appDir = path.join(tempDir, 'MyApp');
      const appXcodeproj = path.join(appDir, 'MyApp.xcodeproj');
      fs.mkdirSync(appXcodeproj, { recursive: true });
      fs.writeFileSync(path.join(appXcodeproj, 'project.pbxproj'), `
buildSettings = {
  INFOPLIST_FILE = "MyApp/Info.plist";
};`);
      const appInfoDir = path.join(appDir, 'MyApp');
      fs.mkdirSync(appInfoDir, { recursive: true });
      fs.writeFileSync(path.join(appInfoDir, 'Info.plist'), '<?xml version="1.0"?><app/>');
      
      // Pods project
      const podsDir = path.join(tempDir, 'Pods');
      const podsXcodeproj = path.join(podsDir, 'Pods.xcodeproj');
      fs.mkdirSync(podsXcodeproj, { recursive: true });
      fs.writeFileSync(path.join(podsXcodeproj, 'project.pbxproj'), '// pods');
      
      const workspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`;
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), workspaceData);
      
      const discovery = discoverProject(workspaceDir);
      
      // Should find app project and use pbxproj path for Info.plist
      expect(discovery.pbxprojPath).toBe(path.join(appXcodeproj, 'project.pbxproj'));
      expect(discovery.infoPlistPath).toBe(path.join(appInfoDir, 'Info.plist'));
    });
  });

  describe('P2-A/B/C Regression: Monorepo scope bleeding prevention', () => {
    it('P2-B: should NOT pick Info.plist from sibling project directories', () => {
      // Regression test: Sibling apps under same parent
      // When scanning AppB.xcodeproj, should NOT pick AppA's Info.plist
      
      // Create monorepo structure:
      // monorepo/
      //   AppA/
      //     AppA.xcodeproj/project.pbxproj
      //     Info.plist          <- AppA's plist (should be ignored when scanning AppB)
      //   AppB/
      //     AppB.xcodeproj/project.pbxproj
      //     (no Info.plist - must NOT fall back to AppA's)
      
      // Create AppA with Info.plist
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA project');
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.test.AppA</string></dict></plist>');
      
      // Create AppB WITHOUT Info.plist
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB project');
      // Intentionally no Info.plist in AppB
      
      // Scan from AppB's xcodeproj - should NOT find AppA's Info.plist
      const discovery = discoverProject(appBXcode);
      
      expect(discovery.pbxprojPath).toBe(path.join(appBXcode, 'project.pbxproj'));
      // P2-B fix: Should NOT have picked up AppA's Info.plist
      // infoPlistPath should be undefined, NOT AppA's Info.plist
      if (discovery.infoPlistPath) {
        expect(discovery.infoPlistPath).not.toContain('AppA');
      }
    });

    it('P2-B: should pick correct plist when target name differs from folder name', () => {
      // Regression test: Target name differs from folder name
      // Fallback should still find the plist in current project, not sibling
      
      // monorepo/
      //   AppA/
      //     AppA.xcodeproj/project.pbxproj (target name: "MyAppA")
      //     MyAppA/Info.plist              <- should be found via targetName
      //   AppB/
      //     AppB.xcodeproj/project.pbxproj (target name: "MyAppB")
      //     MyAppB/Info.plist              <- should be found when scanning AppB
      
      // Create AppA
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      const appATargetDir = path.join(appADir, 'MyAppA');
      fs.mkdirSync(appATargetDir);
      fs.writeFileSync(path.join(appATargetDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>A</string></dict></plist>');
      // pbxproj with target that has different name from folder
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), `
/* Begin PBXNativeTarget section */
        AAAAAAAAAAAAAAAAAAAAAAAA /* MyAppA */ = {
          isa = PBXNativeTarget;
          productType = "com.apple.product-type.application";
          buildConfigurationList = BBBBBBBBBBBBBBBBBBBBBBBB;
          productName = MyAppA;
        };
/* End PBXNativeTarget section */
/* Begin XCConfigurationList section */
        BBBBBBBBBBBBBBBBBBBBBBBB /* Build configuration list for PBXNativeTarget */ = {
          isa = XCConfigurationList;
          buildConfigurations = (
            CCCCCCCCCCCCCCCCCCCCCCCC,
          );
        };
/* End XCConfigurationList section */
/* Begin XCBuildConfiguration section */
        CCCCCCCCCCCCCCCCCCCCCCCC /* Debug */ = {
          isa = XCBuildConfiguration;
          buildSettings = {
            INFOPLIST_FILE = "MyAppA/Info.plist";
          };
          name = Debug;
        };
/* End XCBuildConfiguration section */
`);
      
      // Create AppB with different target name
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      const appBTargetDir = path.join(appBDir, 'MyAppB');
      fs.mkdirSync(appBTargetDir);
      fs.writeFileSync(path.join(appBTargetDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>app</key><string>B</string></dict></plist>');
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), `
/* Begin PBXNativeTarget section */
        DDDDDDDDDDDDDDDDDDDDDDDD /* MyAppB */ = {
          isa = PBXNativeTarget;
          productType = "com.apple.product-type.application";
          buildConfigurationList = EEEEEEEEEEEEEEEEEEEEEEEE;
          productName = MyAppB;
        };
/* End PBXNativeTarget section */
/* Begin XCConfigurationList section */
        EEEEEEEEEEEEEEEEEEEEEEEE /* Build configuration list for PBXNativeTarget */ = {
          isa = XCConfigurationList;
          buildConfigurations = (
            FFFFFFFFFFFFFFFFFFFFFFFF,
          );
        };
/* End XCConfigurationList section */
/* Begin XCBuildConfiguration section */
        FFFFFFFFFFFFFFFFFFFFFFFF /* Debug */ = {
          isa = XCBuildConfiguration;
          buildSettings = {
            INFOPLIST_FILE = "MyAppB/Info.plist";
          };
          name = Debug;
        };
/* End XCBuildConfiguration section */
`);
      
      // Scan from AppB
      const discovery = discoverProject(appBXcode);
      
      expect(discovery.pbxprojPath).toBe(path.join(appBXcode, 'project.pbxproj'));
      // Should find AppB's Info.plist via pbxproj parsing
      expect(discovery.infoPlistPath).toBe(path.join(appBTargetDir, 'Info.plist'));
      expect(discovery.targetName).toBe('MyAppB');
    });

    it('P2-A: should set dependencyScopeDir for direct .xcodeproj input', () => {
      // Verify that dependencyScopeDir is set correctly for scoped dependency loading
      
      const appDir = path.join(tempDir, 'MyApp');
      const appXcode = path.join(appDir, 'MyApp.xcodeproj');
      fs.mkdirSync(appXcode, { recursive: true });
      fs.writeFileSync(path.join(appXcode, 'project.pbxproj'), '// project');
      
      const discovery = discoverProject(appXcode);
      
      // dependencyScopeDir should be the .xcodeproj itself (not the parent)
      expect(discovery.dependencyScopeDir).toBe(appXcode);
      expect(discovery.projectScopeDir).toBe(appDir);
    });

    it('P1 Regression: should set dependencyScopeDir for workspace scans in monorepo', () => {
      // Regression test: Workspace scan should scope dependencies to prevent loading sibling lockfiles
      // In monorepo with AppA and AppB, scanning workspace should only load selected app's dependencies
      
      const workspaceDir = path.join(tempDir, 'MyMonorepo.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      // Create AppA with its own Package.resolved
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?>');
      
      // Create AppB with its own Package.resolved
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
      fs.writeFileSync(path.join(appBDir, 'Info.plist'), '<?xml version="1.0"?>');
      
      // Workspace data references AppA
      const workspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:AppA/AppA.xcodeproj"/>
</Workspace>`;
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), workspaceData);
      
      const discovery = discoverProject(workspaceDir);
      
      // P1 FIX: dependencyScopeDir should be set to the selected .xcodeproj path
      // This ensures loadAllDependencies() only searches within AppA, not AppB
      expect(discovery.dependencyScopeDir).toBe(appAXcode);
      expect(discovery.projectScopeDir).toBe(appADir);
    });

    it('P1 Regression: should set dependencyScopeDir for root directory scans in monorepo', () => {
      // Regression test: Root directory scan should scope dependencies to prevent loading sibling lockfiles
      
      // Create AppA
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
      
      // Create AppB (should not have its dependencies loaded when AppA is selected)
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
      
      // Scan from root - will pick first xcodeproj (alphabetical: AppA)
      const discovery = discoverProject(tempDir);
      
      // P1 FIX: dependencyScopeDir should be set to the discovered .xcodeproj path
      expect(discovery.dependencyScopeDir).toBe(appAXcode);
      expect(discovery.projectScopeDir).toBe(appADir);
    });

    it('P2-C Regression: should NOT pick root Info.plist when monorepo has multiple xcodeprojs', () => {
      // Regression test: Root-level plist with siblings
      // If root directory contains multiple .xcodeproj bundles, skip root-level artifact checks
      
      // Create monorepo structure:
      // monorepo/
      //   Info.plist           <- Root plist (should be SKIPPED when multiple xcodeprojs exist)
      //   AppA/
      //     AppA.xcodeproj/project.pbxproj
      //     AppA/Info.plist    <- AppA's nested plist
      //   AppB/
      //     AppB.xcodeproj/project.pbxproj
      //     AppB/Info.plist    <- AppB's nested plist
      
      // Create root Info.plist (this is the problem case - should NOT be picked)
      fs.writeFileSync(path.join(tempDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>name</key><string>ROOT</string></dict></plist>');
      
      // Create AppA with nested Info.plist
      const appADir = path.join(tempDir, 'AppA');
      const appAXcode = path.join(appADir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode, { recursive: true });
      const appATargetDir = path.join(appADir, 'AppA');
      fs.mkdirSync(appATargetDir);
      fs.writeFileSync(path.join(appATargetDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>name</key><string>AppA</string></dict></plist>');
      // pbxproj specifies nested path
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), `
buildSettings = {
  INFOPLIST_FILE = "AppA/Info.plist";
};`);
      
      // Create AppB with nested Info.plist
      const appBDir = path.join(tempDir, 'AppB');
      const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode, { recursive: true });
      const appBTargetDir = path.join(appBDir, 'AppB');
      fs.mkdirSync(appBTargetDir);
      fs.writeFileSync(path.join(appBTargetDir, 'Info.plist'), '<?xml version="1.0"?><plist><dict><key>name</key><string>AppB</string></dict></plist>');
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), `
buildSettings = {
  INFOPLIST_FILE = "AppB/Info.plist";
};`);
      
      // Scan from AppA's xcodeproj
      const discoveryA = discoverProject(appAXcode);
      
      // Should find AppA's nested Info.plist via pbxproj, NOT the root one
      expect(discoveryA.infoPlistPath).toBe(path.join(appATargetDir, 'Info.plist'));
      expect(discoveryA.infoPlistPath).not.toBe(path.join(tempDir, 'Info.plist'));
      
      // Scan from AppB's xcodeproj
      const discoveryB = discoverProject(appBXcode);
      
      // Should find AppB's nested Info.plist, NOT the root one
      expect(discoveryB.infoPlistPath).toBe(path.join(appBTargetDir, 'Info.plist'));
      expect(discoveryB.infoPlistPath).not.toBe(path.join(tempDir, 'Info.plist'));
    });

    it('P2-C Regression: fallback should skip root plist when project scope has sibling xcodeprojs', () => {
      // Regression test: When pbxproj parsing fails and fallback kicks in,
      // should STILL not pick root plist if there are multiple xcodeprojs at that level
      
      // Create monorepo structure:
      // monorepo/
      //   Info.plist           <- Root plist (should NOT be picked)
      //   AppA.xcodeproj/      <- First project at root level
      //   AppB.xcodeproj/      <- Second project at root level
      //   AppA/Info.plist      <- AppA's plist
      //   AppB/Info.plist      <- AppB's plist
      
      // Create root Info.plist
      fs.writeFileSync(path.join(tempDir, 'Info.plist'), '<?xml version="1.0"?><root/>');
      
      // Create AppA.xcodeproj at root level (without valid INFOPLIST_FILE to force fallback)
      const appAXcode = path.join(tempDir, 'AppA.xcodeproj');
      fs.mkdirSync(appAXcode);
      fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// no INFOPLIST_FILE');
      
      // Create AppB.xcodeproj at root level
      const appBXcode = path.join(tempDir, 'AppB.xcodeproj');
      fs.mkdirSync(appBXcode);
      fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// no INFOPLIST_FILE');
      
      // Create AppA target directory with Info.plist
      const appADir = path.join(tempDir, 'AppA');
      fs.mkdirSync(appADir);
      fs.writeFileSync(path.join(appADir, 'Info.plist'), '<?xml version="1.0"?><appA/>');
      
      // Create AppB target directory with Info.plist
      const appBDir = path.join(tempDir, 'AppB');
      fs.mkdirSync(appBDir);
      fs.writeFileSync(path.join(appBDir, 'Info.plist'), '<?xml version="1.0"?><appB/>');
      
      // Scan from root (should pick first xcodeproj: AppA)
      const discovery = discoverProject(tempDir);
      
      // P2-C FIX: Should NOT pick root Info.plist because tempDir has multiple xcodeprojs
      // Should instead find AppA/Info.plist via recursive search
      expect(discovery.infoPlistPath).not.toBe(path.join(tempDir, 'Info.plist'));
      // The recursive search with sibling exclusion should find AppA/Info.plist
      expect(discovery.infoPlistPath).toBe(path.join(appADir, 'Info.plist'));
    });
  });
});
