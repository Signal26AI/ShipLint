/**
 * Tests for framework-detector.ts
 * Covers bug fix #3: Recursive lockfile discovery
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  loadAllDependencies,
  loadDependenciesForProject,
  parsePodfileLockContent,
  parsePackageResolvedData,
  detectTrackingSDKs,
  detectSocialLoginSDKs 
} from '../../src/parsers/framework-detector';
import { DependencySource } from '../../src/types';

describe('loadAllDependencies', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-deps-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Bug Fix #3: Recursive lockfile discovery', () => {
    it('should find Podfile.lock in nested ios directory', () => {
      // Common React Native structure: ios/Podfile.lock
      const iosDir = path.join(tempDir, 'ios');
      fs.mkdirSync(iosDir, { recursive: true });
      fs.writeFileSync(path.join(iosDir, 'Podfile.lock'), `PODS:
  - Alamofire (5.6.4)

DEPENDENCIES:
  - Alamofire

SPEC CHECKSUMS:
  Alamofire: abc123

COCOAPODS: 1.12.0
`);

      const deps = loadAllDependencies(tempDir);

      expect(deps.some(d => d.name === 'Alamofire')).toBe(true);
      expect(deps.find(d => d.name === 'Alamofire')?.source).toBe(DependencySource.CocoaPods);
    });

    it('should find Package.resolved in nested locations', () => {
      // Create nested SPM resolved file
      const nestedDir = path.join(tempDir, 'packages', 'ios-app');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'Package.resolved'), JSON.stringify({
        pins: [
          { identity: 'swift-algorithms', state: { version: '1.0.0' } }
        ]
      }));

      const deps = loadAllDependencies(tempDir);

      expect(deps.some(d => d.name === 'swift-algorithms')).toBe(true);
      expect(deps.find(d => d.name === 'swift-algorithms')?.source).toBe(DependencySource.SPM);
    });

    it('should find Package.resolved inside .xcodeproj bundle', () => {
      // Create structure: MyApp.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
      const spmDir = path.join(tempDir, 'MyApp.xcodeproj', 'project.xcworkspace', 'xcshareddata', 'swiftpm');
      fs.mkdirSync(spmDir, { recursive: true });
      fs.writeFileSync(path.join(spmDir, 'Package.resolved'), JSON.stringify({
        pins: [
          { identity: 'swift-collections', state: { version: '1.0.4' } }
        ]
      }));

      const deps = loadAllDependencies(tempDir);

      expect(deps.some(d => d.name === 'swift-collections')).toBe(true);
    });

    it('should find lockfiles in multiple locations and dedupe', () => {
      // Root Podfile.lock
      fs.writeFileSync(path.join(tempDir, 'Podfile.lock'), `PODS:
  - AFNetworking (4.0.1)

COCOAPODS: 1.12.0
`);

      // Nested ios/ Podfile.lock with same dependency
      const iosDir = path.join(tempDir, 'ios');
      fs.mkdirSync(iosDir);
      fs.writeFileSync(path.join(iosDir, 'Podfile.lock'), `PODS:
  - AFNetworking (4.0.1)

COCOAPODS: 1.12.0
`);

      const deps = loadAllDependencies(tempDir);

      // Should dedupe by name@version
      const afnetworking = deps.filter(d => d.name === 'AFNetworking');
      expect(afnetworking.length).toBe(1);
    });

    it('should handle monorepo with multiple iOS apps', () => {
      // apps/app1/ios/Podfile.lock
      const app1Dir = path.join(tempDir, 'apps', 'app1', 'ios');
      fs.mkdirSync(app1Dir, { recursive: true });
      fs.writeFileSync(path.join(app1Dir, 'Podfile.lock'), `PODS:
  - Firebase (10.0.0)

COCOAPODS: 1.12.0
`);

      // apps/app2/ios/Podfile.lock
      const app2Dir = path.join(tempDir, 'apps', 'app2', 'ios');
      fs.mkdirSync(app2Dir, { recursive: true });
      fs.writeFileSync(path.join(app2Dir, 'Podfile.lock'), `PODS:
  - Realm (10.40.0)

COCOAPODS: 1.12.0
`);

      const deps = loadAllDependencies(tempDir);

      expect(deps.some(d => d.name === 'Firebase')).toBe(true);
      expect(deps.some(d => d.name === 'Realm')).toBe(true);
    });

    it('should check .swiftpm/Package.resolved location', () => {
      const swiftpmDir = path.join(tempDir, '.swiftpm');
      fs.mkdirSync(swiftpmDir);
      fs.writeFileSync(path.join(swiftpmDir, 'Package.resolved'), JSON.stringify({
        pins: [
          { identity: 'swift-nio', state: { version: '2.0.0' } }
        ]
      }));

      const deps = loadAllDependencies(tempDir);

      expect(deps.some(d => d.name === 'swift-nio')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for empty directory', () => {
      const deps = loadAllDependencies(tempDir);
      expect(deps).toEqual([]);
    });

    it('should handle malformed Podfile.lock gracefully', () => {
      fs.writeFileSync(path.join(tempDir, 'Podfile.lock'), 'not valid yaml format');
      
      // Should not throw
      const deps = loadAllDependencies(tempDir);
      expect(Array.isArray(deps)).toBe(true);
    });

    it('should handle malformed Package.resolved gracefully', () => {
      fs.writeFileSync(path.join(tempDir, 'Package.resolved'), 'not json');
      
      // Should not throw
      const deps = loadAllDependencies(tempDir);
      expect(Array.isArray(deps)).toBe(true);
    });
  });
});

describe('parsePodfileLockContent', () => {
  it('should parse pods with versions', () => {
    const content = `PODS:
  - Alamofire (5.6.4)
  - Firebase/Analytics (10.0.0):
    - FirebaseAnalytics
  - FirebaseAnalytics (10.0.0)

DEPENDENCIES:
  - Alamofire
  - Firebase/Analytics

COCOAPODS: 1.12.0
`;

    const deps = parsePodfileLockContent(content);

    expect(deps.some(d => d.name === 'Alamofire' && d.version === '5.6.4')).toBe(true);
    expect(deps.some(d => d.name === 'Firebase')).toBe(true);
    expect(deps.some(d => d.name === 'Firebase/Analytics')).toBe(true);
  });

  it('should handle subspecs correctly', () => {
    const content = `PODS:
  - Firebase/Core (10.0.0)
  - Firebase/Analytics (10.0.0)

COCOAPODS: 1.12.0
`;

    const deps = parsePodfileLockContent(content);

    // Should have base name and subspecs
    expect(deps.some(d => d.name === 'Firebase')).toBe(true);
    expect(deps.some(d => d.name === 'Firebase/Core')).toBe(true);
    expect(deps.some(d => d.name === 'Firebase/Analytics')).toBe(true);
  });
});

describe('parsePackageResolvedData', () => {
  it('should parse v2 format', () => {
    const data = {
      pins: [
        { identity: 'swift-algorithms', state: { version: '1.0.0' } },
        { identity: 'swift-collections', state: { version: '1.0.4' } }
      ]
    };

    const deps = parsePackageResolvedData(data);

    expect(deps).toHaveLength(2);
    expect(deps.some(d => d.name === 'swift-algorithms')).toBe(true);
  });

  it('should parse v1 format', () => {
    const data = {
      object: {
        pins: [
          { package: 'Alamofire', state: { version: '5.6.4' } }
        ]
      }
    };

    const deps = parsePackageResolvedData(data);

    expect(deps.some(d => d.name === 'Alamofire')).toBe(true);
  });
});

describe('detectTrackingSDKs', () => {
  it('should detect Facebook SDK', () => {
    const deps = [
      { name: 'FBSDKCoreKit', version: '16.0.0', source: DependencySource.CocoaPods }
    ];

    const tracking = detectTrackingSDKs(deps);

    expect(tracking).toContain('Facebook SDK');
  });

  it('should detect Firebase Analytics', () => {
    const deps = [
      { name: 'Firebase/Analytics', version: '10.0.0', source: DependencySource.CocoaPods }
    ];

    const tracking = detectTrackingSDKs(deps);

    expect(tracking).toContain('Firebase Analytics');
  });
});

describe('detectSocialLoginSDKs', () => {
  it('should detect Google Sign-In', () => {
    const deps = [
      { name: 'GoogleSignIn', version: '7.0.0', source: DependencySource.CocoaPods }
    ];

    const social = detectSocialLoginSDKs(deps);

    expect(social).toContain('Google Sign-In');
  });

  it('should detect Facebook Login', () => {
    const deps = [
      { name: 'FBSDKLoginKit', version: '16.0.0', source: DependencySource.CocoaPods }
    ];

    const social = detectSocialLoginSDKs(deps);

    expect(social).toContain('Facebook Login');
  });
});

describe('P2-C Regression: Scoped dependency loading', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-deps-scope-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('P2-C: loadDependenciesForProject should ignore unrelated lockfiles in monorepo', () => {
    // Regression test: Monorepo root with multiple lockfiles
    // Direct .xcodeproj scan should ignore unrelated lockfiles from sibling projects
    
    // monorepo/
    //   AppA/
    //     AppA.xcodeproj/project.pbxproj
    //     Podfile.lock (Firebase)
    //   AppB/
    //     AppB.xcodeproj/project.pbxproj
    //     Podfile.lock (Alamofire)
    
    // Create AppA with Firebase dependency
    const appADir = path.join(tempDir, 'AppA');
    const appAXcode = path.join(appADir, 'AppA.xcodeproj');
    fs.mkdirSync(appAXcode, { recursive: true });
    fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
    fs.writeFileSync(path.join(appADir, 'Podfile.lock'), `PODS:
  - Firebase (10.0.0)
  - FirebaseCore (10.0.0)

DEPENDENCIES:
  - Firebase

COCOAPODS: 1.12.0
`);
    
    // Create AppB with Alamofire dependency
    const appBDir = path.join(tempDir, 'AppB');
    const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
    fs.mkdirSync(appBXcode, { recursive: true });
    fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
    fs.writeFileSync(path.join(appBDir, 'Podfile.lock'), `PODS:
  - Alamofire (5.6.4)

DEPENDENCIES:
  - Alamofire

COCOAPODS: 1.12.0
`);
    
    // Load dependencies for AppB specifically
    const depsB = loadDependenciesForProject(appBXcode);
    
    // Should have Alamofire (AppB's dependency)
    expect(depsB.some(d => d.name === 'Alamofire')).toBe(true);
    
    // Should NOT have Firebase (AppA's dependency)
    expect(depsB.some(d => d.name === 'Firebase')).toBe(false);
    expect(depsB.some(d => d.name === 'FirebaseCore')).toBe(false);
  });

  it('P2-C: loadAllDependencies with .xcodeproj path should use scoped loading', () => {
    // When loadAllDependencies is called with a .xcodeproj path directly,
    // it should use scoped loading to prevent picking up sibling lockfiles
    
    // Create sibling apps
    const appADir = path.join(tempDir, 'AppA');
    const appAXcode = path.join(appADir, 'AppA.xcodeproj');
    fs.mkdirSync(appAXcode, { recursive: true });
    fs.writeFileSync(path.join(appAXcode, 'project.pbxproj'), '// AppA');
    fs.writeFileSync(path.join(appADir, 'Podfile.lock'), `PODS:
  - SDWebImage (5.0.0)

COCOAPODS: 1.12.0
`);
    
    const appBDir = path.join(tempDir, 'AppB');
    const appBXcode = path.join(appBDir, 'AppB.xcodeproj');
    fs.mkdirSync(appBXcode, { recursive: true });
    fs.writeFileSync(path.join(appBXcode, 'project.pbxproj'), '// AppB');
    fs.writeFileSync(path.join(appBDir, 'Podfile.lock'), `PODS:
  - Kingfisher (7.0.0)

COCOAPODS: 1.12.0
`);
    
    // Call loadAllDependencies with AppB's .xcodeproj path
    const depsB = loadAllDependencies(appBXcode);
    
    // Should have Kingfisher (AppB's dependency)
    expect(depsB.some(d => d.name === 'Kingfisher')).toBe(true);
    
    // Should NOT have SDWebImage (AppA's dependency)
    expect(depsB.some(d => d.name === 'SDWebImage')).toBe(false);
  });

  it('P2-C: should find Package.resolved inside .xcodeproj bundle', () => {
    // Test that we still find Package.resolved in the proper SPM location
    
    const appDir = path.join(tempDir, 'MyApp');
    const appXcode = path.join(appDir, 'MyApp.xcodeproj');
    const spmDir = path.join(appXcode, 'project.xcworkspace', 'xcshareddata', 'swiftpm');
    fs.mkdirSync(spmDir, { recursive: true });
    fs.writeFileSync(path.join(appXcode, 'project.pbxproj'), '// project');
    fs.writeFileSync(path.join(spmDir, 'Package.resolved'), JSON.stringify({
      pins: [
        { identity: 'swift-algorithms', state: { version: '1.0.0' } }
      ]
    }));
    
    const deps = loadDependenciesForProject(appXcode);
    
    expect(deps.some(d => d.name === 'swift-algorithms')).toBe(true);
  });

  it('P2-C: should find lockfiles in parent directory (workspace root)', () => {
    // Common pattern: Podfile.lock is in parent directory when using workspaces
    
    const appDir = path.join(tempDir, 'MyApp');
    const appXcode = path.join(appDir, 'MyApp.xcodeproj');
    fs.mkdirSync(appXcode, { recursive: true });
    fs.writeFileSync(path.join(appXcode, 'project.pbxproj'), '// project');
    
    // Podfile.lock in parent (workspace root)
    fs.writeFileSync(path.join(tempDir, 'Podfile.lock'), `PODS:
  - SnapKit (5.6.0)

COCOAPODS: 1.12.0
`);
    
    const deps = loadDependenciesForProject(appXcode);
    
    expect(deps.some(d => d.name === 'SnapKit')).toBe(true);
  });
});
