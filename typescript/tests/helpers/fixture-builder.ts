/**
 * Fixture Builder — Programmatically creates minimal but valid Xcode project structures
 * for integration testing.
 *
 * Usage:
 *   const project = new FixtureBuilder('MyApp')
 *     .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
 *     .withPrivacyManifest()
 *     .withEntitlements({ 'aps-environment': 'development' })
 *     .withPodDependency('Firebase', '10.0.0')
 *     .build(tmpDir);
 */
import * as fs from 'fs';
import * as path from 'path';
import plist from 'plist';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FixtureOptions {
  /** Project/target name (default: "TestApp") */
  name: string;
  /** Extra Info.plist keys */
  infoPlistKeys: Record<string, unknown>;
  /** Whether to include a PrivacyInfo.xcprivacy */
  includePrivacyManifest: boolean;
  /** Custom privacy manifest content (XML plist) */
  privacyManifestContent?: string;
  /** Entitlements dict (if set, .entitlements file is created) */
  entitlements?: Record<string, unknown>;
  /** CocoaPods deps for Podfile.lock generation */
  pods: Array<{ name: string; version: string }>;
  /** SPM deps for Package.resolved generation */
  spmPackages: Array<{ identity: string; version: string; url: string }>;
  /** Extra Swift source files: filename → content */
  swiftFiles: Record<string, string>;
  /** Frameworks to link in pbxproj */
  linkedFrameworks: string[];
  /** Build settings overrides */
  buildSettings: Record<string, string>;
  /** Whether to use GENERATE_INFOPLIST_FILE = YES (Xcode 14+ style) */
  generatesInfoPlist: boolean;
}

export interface BuiltFixture {
  /** Root directory of the fixture project */
  projectDir: string;
  /** Path to the .xcodeproj bundle */
  xcodeprojPath: string;
  /** Path to project.pbxproj */
  pbxprojPath: string;
  /** Path to Info.plist (if created) */
  infoPlistPath?: string;
  /** Path to entitlements file (if created) */
  entitlementsPath?: string;
  /** Path to PrivacyInfo.xcprivacy (if created) */
  privacyManifestPath?: string;
}

// ─── Builder ────────────────────────────────────────────────────────────────

export class FixtureBuilder {
  private opts: FixtureOptions;

  constructor(name: string = 'TestApp') {
    this.opts = {
      name,
      infoPlistKeys: {},
      includePrivacyManifest: false,
      pods: [],
      spmPackages: [],
      swiftFiles: {},
      linkedFrameworks: [],
      buildSettings: {},
      generatesInfoPlist: false,
    };
  }

  /** Set a key in Info.plist */
  withInfoPlistKey(key: string, value: unknown): this {
    this.opts.infoPlistKeys[key] = value;
    return this;
  }

  /** Merge multiple Info.plist keys */
  withInfoPlistKeys(keys: Record<string, unknown>): this {
    Object.assign(this.opts.infoPlistKeys, keys);
    return this;
  }

  /** Include a PrivacyInfo.xcprivacy */
  withPrivacyManifest(content?: string): this {
    this.opts.includePrivacyManifest = true;
    this.opts.privacyManifestContent = content;
    return this;
  }

  /** Include an entitlements file with given keys */
  withEntitlements(dict: Record<string, unknown>): this {
    this.opts.entitlements = dict;
    return this;
  }

  /** Add a CocoaPods dependency (creates Podfile.lock) */
  withPodDependency(name: string, version: string = '1.0.0'): this {
    this.opts.pods.push({ name, version });
    return this;
  }

  /** Add an SPM dependency (creates Package.resolved) */
  withSPMPackage(identity: string, version: string = '1.0.0', url: string = ''): this {
    this.opts.spmPackages.push({ identity, version, url: url || `https://github.com/example/${identity}` });
    return this;
  }

  /** Add a Swift source file */
  withSwiftFile(filename: string, content: string): this {
    this.opts.swiftFiles[filename] = content;
    return this;
  }

  /** Link a framework in pbxproj */
  withLinkedFramework(name: string): this {
    this.opts.linkedFrameworks.push(name);
    return this;
  }

  /** Override a build setting */
  withBuildSetting(key: string, value: string): this {
    this.opts.buildSettings[key] = value;
    return this;
  }

  /** Use GENERATE_INFOPLIST_FILE = YES */
  withGeneratedInfoPlist(): this {
    this.opts.generatesInfoPlist = true;
    return this;
  }

  /**
   * Materialize the fixture on disk.
   * @param baseDir Parent directory; a project subdirectory is created inside.
   * @returns paths to key artifacts.
   */
  build(baseDir: string): BuiltFixture {
    const name = this.opts.name;
    const projectDir = path.join(baseDir, name);
    const targetDir = path.join(projectDir, name);
    const xcodeprojDir = path.join(projectDir, `${name}.xcodeproj`);

    // Create directories
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(xcodeprojDir, { recursive: true });

    const result: BuiltFixture = {
      projectDir,
      xcodeprojPath: xcodeprojDir,
      pbxprojPath: path.join(xcodeprojDir, 'project.pbxproj'),
    };

    // ── Info.plist ────────────────────────────────────────────────────────
    if (!this.opts.generatesInfoPlist) {
      const infoPlistDict: Record<string, unknown> = {
        CFBundleDevelopmentRegion: '$(DEVELOPMENT_LANGUAGE)',
        CFBundleExecutable: '$(EXECUTABLE_NAME)',
        CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
        CFBundleInfoDictionaryVersion: '6.0',
        CFBundleName: '$(PRODUCT_NAME)',
        CFBundlePackageType: 'APPL',
        CFBundleShortVersionString: '1.0',
        CFBundleVersion: '1',
        LSRequiresIPhoneOS: true,
        UILaunchStoryboardName: 'LaunchScreen',
        UISupportedInterfaceOrientations: [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ],
        ...this.opts.infoPlistKeys,
      };

      const infoPlistPath = path.join(targetDir, 'Info.plist');
      fs.writeFileSync(infoPlistPath, plist.build(infoPlistDict as any), 'utf-8');
      result.infoPlistPath = infoPlistPath;
    }

    // ── Entitlements ─────────────────────────────────────────────────────
    if (this.opts.entitlements) {
      const entPath = path.join(targetDir, `${name}.entitlements`);
      fs.writeFileSync(entPath, plist.build(this.opts.entitlements as any), 'utf-8');
      result.entitlementsPath = entPath;
    }

    // ── PrivacyInfo.xcprivacy ────────────────────────────────────────────
    if (this.opts.includePrivacyManifest) {
      const privacyPath = path.join(targetDir, 'PrivacyInfo.xcprivacy');
      const content =
        this.opts.privacyManifestContent ??
        plist.build({
          NSPrivacyTracking: false,
          NSPrivacyCollectedDataTypes: [],
          NSPrivacyAccessedAPITypes: [],
        } as any);
      fs.writeFileSync(privacyPath, content, 'utf-8');
      result.privacyManifestPath = privacyPath;
    }

    // ── Swift source files ───────────────────────────────────────────────
    for (const [filename, content] of Object.entries(this.opts.swiftFiles)) {
      fs.writeFileSync(path.join(targetDir, filename), content, 'utf-8');
    }

    // ── Podfile.lock ─────────────────────────────────────────────────────
    if (this.opts.pods.length > 0) {
      const podfileContent = this.generatePodfileLock();
      fs.writeFileSync(path.join(projectDir, 'Podfile.lock'), podfileContent, 'utf-8');
    }

    // ── Package.resolved (SPM) ──────────────────────────────────────────
    if (this.opts.spmPackages.length > 0) {
      const spmDir = path.join(xcodeprojDir, 'project.xcworkspace', 'xcshareddata', 'swiftpm');
      fs.mkdirSync(spmDir, { recursive: true });
      fs.writeFileSync(
        path.join(spmDir, 'Package.resolved'),
        this.generatePackageResolved(),
        'utf-8',
      );
    }

    // ── project.pbxproj ─────────────────────────────────────────────────
    fs.writeFileSync(result.pbxprojPath, this.generatePbxproj(), 'utf-8');

    return result;
  }

  // ─── Generators ─────────────────────────────────────────────────────────

  private generatePbxproj(): string {
    const name = this.opts.name;
    const infoPlistRelPath = this.opts.generatesInfoPlist ? '' : `${name}/Info.plist`;
    const entRelPath = this.opts.entitlements ? `${name}/${name}.entitlements` : '';

    // Build settings
    const extraBS: string[] = [];
    if (infoPlistRelPath) {
      extraBS.push(`\t\t\t\tINFOPLIST_FILE = "${infoPlistRelPath}";`);
    }
    if (entRelPath) {
      extraBS.push(`\t\t\t\tCODE_SIGN_ENTITLEMENTS = "${entRelPath}";`);
    }
    if (this.opts.generatesInfoPlist) {
      extraBS.push(`\t\t\t\tGENERATE_INFOPLIST_FILE = YES;`);
    }
    for (const [k, v] of Object.entries(this.opts.buildSettings)) {
      extraBS.push(`\t\t\t\t${k} = "${v}";`);
    }
    // Handle INFOPLIST_KEY_ settings from info plist keys when using generated Info.plist
    if (this.opts.generatesInfoPlist) {
      for (const [k, v] of Object.entries(this.opts.infoPlistKeys)) {
        if (typeof v === 'boolean') {
          extraBS.push(`\t\t\t\tINFOPLIST_KEY_${k} = ${v ? 'YES' : 'NO'};`);
        } else if (typeof v === 'string') {
          extraBS.push(`\t\t\t\tINFOPLIST_KEY_${k} = "${v}";`);
        }
      }
    }
    const buildSettingsBlock = extraBS.join('\n');

    // Framework build phases
    const fwRefs = this.opts.linkedFrameworks
      .map((fw, i) => {
        const id = padId(80 + i);
        return `\t\t${id} /* ${fw}.framework in Frameworks */ = {isa = PBXBuildFile; fileRef = ${padId(90 + i)} /* ${fw}.framework */; };`;
      })
      .join('\n');

    const fwFileRefs = this.opts.linkedFrameworks
      .map((fw, i) => {
        const id = padId(90 + i);
        return `\t\t${id} /* ${fw}.framework */ = {isa = PBXFileReference; lastKnownFileType = wrapper.framework; name = ${fw}.framework; path = System/Library/Frameworks/${fw}.framework; sourceTree = SDKROOT; };`;
      })
      .join('\n');

    const fwBuildFileIds = this.opts.linkedFrameworks
      .map((_fw, i) => `\t\t\t\t${padId(80 + i)} /* ${this.opts.linkedFrameworks[i]}.framework in Frameworks */,`)
      .join('\n');

    return `// !$*UTF8*$!
{
\tarchiveVersion = 1;
\tclasses = {
\t};
\tobjectVersion = 56;
\tobjects = {

/* Begin PBXBuildFile section */
${fwRefs}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
${fwFileRefs}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
\t\tAA000000000000000001 /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
${fwBuildFileIds}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXNativeTarget section */
\t\tAA000000000000000010 /* ${name} */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = AA000000000000000030 /* Build configuration list for PBXNativeTarget "${name}" */;
\t\t\tbuildPhases = (
\t\t\t\tAA000000000000000001 /* Frameworks */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = "${name}";
\t\t\tproductName = "${name}";
\t\t\tproductReference = AA000000000000000011 /* ${name}.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\tAA000000000000000000 /* Project object */ = {
\t\t\tisa = PBXProject;
\t\t\tbuildConfigurationList = AA000000000000000040 /* Build configuration list for PBXProject "${name}" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = en;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\ten,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = AA000000000000000002;
\t\t\tproductRefGroup = AA000000000000000003 /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\tAA000000000000000010 /* ${name} */,
\t\t\t);
\t\t};
/* End PBXProject section */

/* Begin XCBuildConfiguration section */
\t\tAA000000000000000020 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.test.${name}";
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
${buildSettingsBlock}
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tAA000000000000000021 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = "com.test.${name}";
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = 17.0;
${buildSettingsBlock}
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\tAA000000000000000050 /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\tAA000000000000000051 /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t};
\t\t\tname = Release;
\t\t};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\tAA000000000000000030 /* Build configuration list for PBXNativeTarget "${name}" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\tAA000000000000000020 /* Debug */,
\t\t\t\tAA000000000000000021 /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
\t\tAA000000000000000040 /* Build configuration list for PBXProject "${name}" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\tAA000000000000000050 /* Debug */,
\t\t\t\tAA000000000000000051 /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
/* End XCConfigurationList section */

\t};
\trootObject = AA000000000000000000 /* Project object */;
}
`;
  }

  private generatePodfileLock(): string {
    const pods = this.opts.pods;
    const podLines = pods.map((p) => `  - ${p.name} (${p.version})`).join('\n');
    const depLines = pods.map((p) => `  - ${p.name} (= ${p.version})`).join('\n');
    return `PODS:
${podLines}

DEPENDENCIES:
${depLines}

SPEC REPOS:
  trunk:
${pods.map((p) => `    - ${p.name}`).join('\n')}

SPEC CHECKSUMS:
${pods.map((p) => `  ${p.name}: ${'a'.repeat(40)}`).join('\n')}

PODFILE CHECKSUM: ${'b'.repeat(40)}

COCOAPODS: 1.15.0
`;
  }

  private generatePackageResolved(): string {
    const pins = this.opts.spmPackages.map((pkg) => ({
      identity: pkg.identity,
      kind: 'remoteSourceControl',
      location: pkg.url,
      state: {
        revision: 'a'.repeat(40),
        version: pkg.version,
      },
    }));
    return JSON.stringify({ pins, version: 3 }, null, 2);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function padId(n: number): string {
  return 'AA' + String(n).padStart(22, '0');
}
