/**
 * Tests for workspace-parser.ts
 * 
 * P1 Fix: Tests for parsing contents.xcworkspacedata to get actual project references
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  parseWorkspaceData,
  parseWorkspaceDataString,
  getWorkspaceProjects,
  resolveProjectRef,
} from '../../src/parsers/workspace-parser';

describe('workspace-parser', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-workspace-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parseWorkspaceDataString', () => {
    it('should parse a simple workspace with one project', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.version).toBe('1.0');
      expect(result.projectRefs).toHaveLength(1);
      expect(result.projectRefs[0].rawLocation).toBe('group:MyApp/MyApp.xcodeproj');
      expect(result.projectRefs[0].locationType).toBe('group');
      expect(result.projectRefs[0].projectPath).toBe('MyApp/MyApp.xcodeproj');
      expect(result.projectRefs[0].isPods).toBe(false);
      expect(result.mainProjectRefs).toHaveLength(1);
    });

    it('should parse workspace with multiple projects', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:AppA/AppA.xcodeproj"/>
   <FileRef location="group:AppB/AppB.xcodeproj"/>
   <FileRef location="group:Shared/Shared.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(3);
      expect(result.mainProjectRefs).toHaveLength(3);
    });

    it('should identify and filter Pods projects', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(2);
      expect(result.projectRefs[1].isPods).toBe(true);
      expect(result.mainProjectRefs).toHaveLength(1);
      expect(result.mainProjectRefs[0].projectPath).toBe('MyApp.xcodeproj');
    });

    it('should identify test/example projects', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:MyAppTests/MyAppTests.xcodeproj"/>
   <FileRef location="group:Example/Example.xcodeproj"/>
   <FileRef location="group:Demo/Demo.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(4);
      expect(result.projectRefs[0].isTestOrExample).toBe(false);
      expect(result.projectRefs[1].isTestOrExample).toBe(true);
      expect(result.projectRefs[2].isTestOrExample).toBe(true);
      expect(result.projectRefs[3].isTestOrExample).toBe(true);
      expect(result.mainProjectRefs).toHaveLength(1);
    });

    it('should handle absolute location type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="absolute:/Users/dev/Projects/MyApp.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs[0].locationType).toBe('absolute');
      expect(result.projectRefs[0].projectPath).toBe('/Users/dev/Projects/MyApp.xcodeproj');
    });

    it('should handle container location type', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="container:MyApp.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs[0].locationType).toBe('container');
    });

    it('should skip non-xcodeproj FileRefs', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:README.md"/>
   <FileRef location="group:Frameworks/"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(1);
    });

    it('should handle empty workspace', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(0);
      expect(result.mainProjectRefs).toHaveLength(0);
    });

    it('should handle workspace with only Pods', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`;

      const result = parseWorkspaceDataString(xml);

      expect(result.projectRefs).toHaveLength(1);
      expect(result.mainProjectRefs).toHaveLength(0);
    });
  });

  describe('parseWorkspaceData', () => {
    it('should parse actual workspace file', () => {
      // Create workspace structure
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const workspaceData = `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`;
      fs.writeFileSync(path.join(workspaceDir, 'contents.xcworkspacedata'), workspaceData);

      const result = parseWorkspaceData(workspaceDir);

      expect(result.version).toBe('1.0');
      expect(result.projectRefs).toHaveLength(2);
      expect(result.mainProjectRefs).toHaveLength(1);
    });

    it('should return empty result for workspace without data file', () => {
      const workspaceDir = path.join(tempDir, 'Empty.xcworkspace');
      fs.mkdirSync(workspaceDir);

      const result = parseWorkspaceData(workspaceDir);

      expect(result.projectRefs).toHaveLength(0);
    });

    it('should accept direct path to contents.xcworkspacedata', () => {
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const dataPath = path.join(workspaceDir, 'contents.xcworkspacedata');
      fs.writeFileSync(dataPath, `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp.xcodeproj"/>
</Workspace>`);

      const result = parseWorkspaceData(dataPath);

      expect(result.projectRefs).toHaveLength(1);
    });
  });

  describe('resolveProjectRef', () => {
    it('should resolve group location relative to workspace dir', () => {
      const ref = {
        rawLocation: 'group:MyApp/MyApp.xcodeproj',
        locationType: 'group' as const,
        projectPath: 'MyApp/MyApp.xcodeproj',
        isPods: false,
        isTestOrExample: false,
      };

      const resolved = resolveProjectRef(ref, '/Projects/MyWorkspace');

      expect(resolved).toBe('/Projects/MyWorkspace/MyApp/MyApp.xcodeproj');
    });

    it('should return absolute paths as-is', () => {
      const ref = {
        rawLocation: 'absolute:/Users/dev/MyApp.xcodeproj',
        locationType: 'absolute' as const,
        projectPath: '/Users/dev/MyApp.xcodeproj',
        isPods: false,
        isTestOrExample: false,
      };

      const resolved = resolveProjectRef(ref, '/Projects/MyWorkspace');

      expect(resolved).toBe('/Users/dev/MyApp.xcodeproj');
    });
  });

  describe('getWorkspaceProjects', () => {
    it('should return resolved paths for existing projects', () => {
      // Create workspace and project structure
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const projectDir = path.join(tempDir, 'MyApp');
      const xcodeprojDir = path.join(projectDir, 'MyApp.xcodeproj');
      fs.mkdirSync(xcodeprojDir, { recursive: true });
      fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// pbxproj');
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      expect(projects).toHaveLength(1);
      expect(projects[0]).toBe(xcodeprojDir);
    });

    it('should skip non-existent projects', () => {
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:NonExistent/NonExistent.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      expect(projects).toHaveLength(0);
    });

    it('should prefer main projects over Pods', () => {
      // Create workspace with both main project and Pods
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      // Create main project
      const mainProjectDir = path.join(tempDir, 'MyApp', 'MyApp.xcodeproj');
      fs.mkdirSync(mainProjectDir, { recursive: true });
      fs.writeFileSync(path.join(mainProjectDir, 'project.pbxproj'), '// main');
      
      // Create Pods project
      const podsProjectDir = path.join(tempDir, 'Pods', 'Pods.xcodeproj');
      fs.mkdirSync(podsProjectDir, { recursive: true });
      fs.writeFileSync(path.join(podsProjectDir, 'project.pbxproj'), '// pods');
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      expect(projects).toHaveLength(1);
      expect(projects[0]).toBe(mainProjectDir);
    });

    it('should fall back to all projects if no main projects', () => {
      // Workspace with only Pods (edge case, but possible)
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const podsProjectDir = path.join(tempDir, 'Pods', 'Pods.xcodeproj');
      fs.mkdirSync(podsProjectDir, { recursive: true });
      fs.writeFileSync(path.join(podsProjectDir, 'project.pbxproj'), '// pods');
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      expect(projects).toHaveLength(1);
      expect(projects[0]).toBe(podsProjectDir);
    });
  });

  describe('Multi-project workspace scenarios', () => {
    it('should handle monorepo workspace with multiple apps', () => {
      // Monorepo structure:
      // Monorepo.xcworkspace/
      // apps/
      //   AppA/AppA.xcodeproj/
      //   AppB/AppB.xcodeproj/
      
      const workspaceDir = path.join(tempDir, 'Monorepo.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const appADir = path.join(tempDir, 'apps', 'AppA', 'AppA.xcodeproj');
      const appBDir = path.join(tempDir, 'apps', 'AppB', 'AppB.xcodeproj');
      fs.mkdirSync(appADir, { recursive: true });
      fs.mkdirSync(appBDir, { recursive: true });
      fs.writeFileSync(path.join(appADir, 'project.pbxproj'), '// AppA');
      fs.writeFileSync(path.join(appBDir, 'project.pbxproj'), '// AppB');
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:apps/AppA/AppA.xcodeproj"/>
   <FileRef location="group:apps/AppB/AppB.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      expect(projects).toHaveLength(2);
      expect(projects).toContain(appADir);
      expect(projects).toContain(appBDir);
    });

    it('should handle CocoaPods workspace (typical structure)', () => {
      // Typical CocoaPods structure:
      // MyApp.xcworkspace/
      // MyApp/
      //   MyApp.xcodeproj/
      // Pods/
      //   Pods.xcodeproj/
      
      const workspaceDir = path.join(tempDir, 'MyApp.xcworkspace');
      fs.mkdirSync(workspaceDir);
      
      const mainProjectDir = path.join(tempDir, 'MyApp', 'MyApp.xcodeproj');
      fs.mkdirSync(mainProjectDir, { recursive: true });
      fs.writeFileSync(path.join(mainProjectDir, 'project.pbxproj'), '// main');
      
      const podsProjectDir = path.join(tempDir, 'Pods', 'Pods.xcodeproj');
      fs.mkdirSync(podsProjectDir, { recursive: true });
      fs.writeFileSync(path.join(podsProjectDir, 'project.pbxproj'), '// pods');
      
      fs.writeFileSync(
        path.join(workspaceDir, 'contents.xcworkspacedata'),
        `<?xml version="1.0" encoding="UTF-8"?>
<Workspace version="1.0">
   <FileRef location="group:MyApp/MyApp.xcodeproj"/>
   <FileRef location="group:Pods/Pods.xcodeproj"/>
</Workspace>`
      );

      const projects = getWorkspaceProjects(workspaceDir);

      // Should return only main project, not Pods
      expect(projects).toHaveLength(1);
      expect(projects[0]).toBe(mainProjectDir);
    });
  });
});
