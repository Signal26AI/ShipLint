/**
 * Utility to detect linked frameworks and dependencies in iOS projects
 */
import * as fs from 'fs';
import * as path from 'path';
import { Dependency, DependencySource } from '../types/index.js';

/**
 * Known tracking SDK patterns for ATT detection
 */
export const trackingSDKPatterns: Array<{ pattern: string; name: string }> = [
  // Facebook/Meta
  { pattern: 'FBSDKCoreKit', name: 'Facebook SDK' },
  { pattern: 'FacebookCore', name: 'Facebook SDK' },
  { pattern: 'FBAudienceNetwork', name: 'Facebook Audience Network' },
  // Google
  { pattern: 'GoogleAnalytics', name: 'Google Analytics' },
  { pattern: 'FirebaseAnalytics', name: 'Firebase Analytics' },
  { pattern: 'Firebase/Analytics', name: 'Firebase Analytics' },
  { pattern: 'Google-Mobile-Ads-SDK', name: 'Google Mobile Ads' },
  { pattern: 'GoogleMobileAds', name: 'Google Mobile Ads' },
  // Attribution/Analytics
  { pattern: 'Adjust', name: 'Adjust' },
  { pattern: 'AppsFlyer', name: 'AppsFlyer' },
  { pattern: 'AppsFlyerFramework', name: 'AppsFlyer' },
  { pattern: 'Branch', name: 'Branch.io' },
  { pattern: 'Amplitude', name: 'Amplitude' },
  { pattern: 'amplitude-ios', name: 'Amplitude' },
  { pattern: 'Mixpanel', name: 'Mixpanel' },
  { pattern: 'Segment', name: 'Segment' },
  { pattern: 'Singular', name: 'Singular' },
  { pattern: 'Kochava', name: 'Kochava' },
  { pattern: 'Tenjin', name: 'Tenjin' },
];

/**
 * Known social login SDK patterns for SIWA detection
 */
export const socialLoginSDKPatterns: Array<{ pattern: string; name: string }> = [
  // Google Sign-In
  { pattern: 'GoogleSignIn', name: 'Google Sign-In' },
  { pattern: 'GIDSignIn', name: 'Google Sign-In' },
  // Facebook Login
  { pattern: 'FBSDKLoginKit', name: 'Facebook Login' },
  { pattern: 'FacebookLogin', name: 'Facebook Login' },
  // Twitter/X
  { pattern: 'TwitterKit', name: 'Twitter Login' },
  // Firebase Auth (may include social)
  { pattern: 'FirebaseAuth', name: 'Firebase Auth' },
  { pattern: 'Firebase/Auth', name: 'Firebase Auth' },
  // Auth0
  { pattern: 'Auth0', name: 'Auth0' },
  // Amazon
  { pattern: 'LoginWithAmazon', name: 'Login with Amazon' },
  // LinkedIn
  { pattern: 'linkedin-sdk', name: 'LinkedIn Login' },
];

/**
 * Location-related frameworks
 */
export const locationFrameworks: Set<string> = new Set([
  'CoreLocation',
  'MapKit',
]);

/**
 * Camera-related frameworks
 */
export const cameraFrameworks: Set<string> = new Set([
  'AVFoundation',
  'AVKit',
  'VisionKit',
]);

/**
 * Parses Podfile.lock to extract CocoaPods dependencies
 */
export function parsePodfileLock(filePath: string): Dependency[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return parsePodfileLockContent(content);
}

/**
 * Parses Podfile.lock content string
 */
export function parsePodfileLockContent(content: string): Dependency[] {
  const dependencies: Dependency[] = [];
  const lines = content.split('\n');
  const seenNames = new Set<string>();
  
  let inPodsSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Start of PODS section
    if (trimmed === 'PODS:') {
      inPodsSection = true;
      continue;
    }
    
    // End of PODS section (next top-level key)
    if (inPodsSection && !line.startsWith(' ') && !line.startsWith('\t') && trimmed.endsWith(':')) {
      break;
    }
    
    // Parse pod entry
    if (inPodsSection && line.startsWith('  - ')) {
      const entry = line.slice(4); // Remove "  - "
      
      // Match: "PodName (version)" or "PodName/Subspec (version)"
      const match = entry.match(/^([^\s(]+)\s*\(([^)]+)\)/);
      if (match) {
        const fullName = match[1];
        const version = match[2];
        
        // Get base name (without subspec)
        const baseName = fullName.split('/')[0];
        
        // Add base name if not seen
        if (!seenNames.has(baseName)) {
          seenNames.add(baseName);
          dependencies.push({
            name: baseName,
            version,
            source: DependencySource.CocoaPods,
          });
        }
        
        // Also track the full name for subspec matching
        if (fullName.includes('/') && !seenNames.has(fullName)) {
          seenNames.add(fullName);
          dependencies.push({
            name: fullName,
            version,
            source: DependencySource.CocoaPods,
          });
        }
      }
    }
  }
  
  return dependencies;
}

/**
 * Parses Package.resolved to extract SPM dependencies
 */
export function parsePackageResolved(filePath: string): Dependency[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  try {
    const json = JSON.parse(content);
    return parsePackageResolvedData(json);
  } catch {
    return [];
  }
}

/**
 * Parses Package.resolved JSON data
 */
export function parsePackageResolvedData(json: Record<string, unknown>): Dependency[] {
  const dependencies: Dependency[] = [];
  
  // Try version 2 format first (newer)
  const pins = json['pins'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(pins)) {
    for (const pin of pins) {
      const identity = pin['identity'] as string;
      const state = pin['state'] as Record<string, unknown> | undefined;
      if (identity) {
        dependencies.push({
          name: identity,
          version: state?.['version'] as string | undefined,
          source: DependencySource.SPM,
        });
      }
    }
    return dependencies;
  }
  
  // Try version 1 format (older)
  const object = json['object'] as Record<string, unknown> | undefined;
  const v1Pins = object?.['pins'] as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(v1Pins)) {
    for (const pin of v1Pins) {
      const pkg = pin['package'] as string;
      const state = pin['state'] as Record<string, unknown> | undefined;
      if (pkg) {
        dependencies.push({
          name: pkg,
          version: state?.['version'] as string | undefined,
          source: DependencySource.SPM,
        });
      }
    }
  }
  
  return dependencies;
}

/**
 * Parses project.pbxproj to extract linked frameworks
 */
export function parseProjectFrameworks(filePath: string): Set<string> {
  if (!fs.existsSync(filePath)) {
    return new Set();
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseProjectFrameworksContent(content);
}

/**
 * Parses project.pbxproj content to extract linked frameworks
 */
export function parseProjectFrameworksContent(content: string): Set<string> {
  const frameworks = new Set<string>();
  
  // Pattern: Framework file references like "AVFoundation.framework"
  const frameworkPattern = /(\w+)\.framework/g;
  let match;
  
  while ((match = frameworkPattern.exec(content)) !== null) {
    frameworks.add(match[1]);
  }
  
  return frameworks;
}

/**
 * Detects tracking SDKs from a list of dependencies
 */
export function detectTrackingSDKs(dependencies: Dependency[]): string[] {
  const detected: string[] = [];
  
  for (const { pattern, name } of trackingSDKPatterns) {
    const found = dependencies.some(dep => 
      dep.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found && !detected.includes(name)) {
      detected.push(name);
    }
  }
  
  return detected;
}

/**
 * Detects social login SDKs from a list of dependencies
 */
export function detectSocialLoginSDKs(dependencies: Dependency[]): string[] {
  const detected: string[] = [];
  
  for (const { pattern, name } of socialLoginSDKPatterns) {
    const found = dependencies.some(dep => 
      dep.name.toLowerCase().includes(pattern.toLowerCase())
    );
    if (found && !detected.includes(name)) {
      detected.push(name);
    }
  }
  
  return detected;
}

/**
 * Maximum depth for recursive directory searches
 */
const MAX_SEARCH_DEPTH = 5;

/**
 * Options for findFilesRecursive
 */
interface FindFilesOptions {
  maxDepth?: number;
  /** Skip directories containing .xcodeproj files not matching this path */
  currentXcodeprojPath?: string;
}

/**
 * Check if directory contains a .xcodeproj different from the specified one
 */
function containsSiblingXcodeproj(dir: string, currentXcodeprojPath?: string): boolean {
  if (!currentXcodeprojPath) return false;
  
  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry.endsWith('.xcodeproj')) {
        const xcprojPath = path.join(dir, entry);
        if (path.resolve(xcprojPath) !== path.resolve(currentXcodeprojPath)) {
          return true;
        }
      }
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Recursively find files matching a predicate
 * P2-C FIX: Can exclude directories containing sibling .xcodeproj files
 */
function findFilesRecursive(
  dir: string,
  predicate: (name: string) => boolean,
  options: FindFilesOptions = {},
  currentDepth: number = 0
): string[] {
  const maxDepth = options.maxDepth ?? MAX_SEARCH_DEPTH;
  if (currentDepth >= maxDepth) return [];
  
  const results: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      
      // Skip common non-project directories for performance
      if (entry === 'node_modules' || entry === '.git' || 
          entry === 'build' || entry === 'DerivedData' || entry === '.build') {
        continue;
      }
      
      if (predicate(entry)) {
        results.push(fullPath);
      }
      
      // Recurse into directories
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && 
            !entry.endsWith('.xcodeproj') && 
            !entry.endsWith('.xcworkspace') &&
            !entry.endsWith('.app') &&
            !entry.endsWith('.framework')) {
          // P2-C FIX: Skip directories containing sibling projects
          if (options.currentXcodeprojPath && containsSiblingXcodeproj(fullPath, options.currentXcodeprojPath)) {
            continue;
          }
          results.push(...findFilesRecursive(fullPath, predicate, options, currentDepth + 1));
        }
      } catch {
        // Ignore stat errors
      }
    }
  } catch {
    // Ignore readdir errors
  }
  
  return results;
}

/**
 * P2-C FIX: Loads dependencies for a specific .xcodeproj, avoiding recursive scan of whole parent
 * 
 * Searches lockfiles only in:
 * 1. The .xcodeproj directory itself (project.xcworkspace/xcshareddata/swiftpm/Package.resolved)
 * 2. The parent directory of the .xcodeproj
 * 3. The parent's .swiftpm directory
 * 
 * This prevents picking up lockfiles from sibling projects in monorepos.
 * 
 * @param xcodeprojPath Path to the .xcodeproj directory
 * @returns Array of dependencies found
 */
export function loadDependenciesForProject(xcodeprojPath: string): Dependency[] {
  const all: Dependency[] = [];
  const seenPodfiles = new Set<string>();
  const seenPackageResolved = new Set<string>();
  
  // Ensure we have the .xcodeproj path
  const xcprojDir = xcodeprojPath.endsWith('.xcodeproj') 
    ? xcodeprojPath 
    : xcodeprojPath.includes('project.pbxproj') 
      ? path.dirname(xcodeprojPath) 
      : xcodeprojPath;
  
  const projectDir = path.dirname(xcprojDir);
  
  // Specific locations to check for Podfile.lock (no recursive scan)
  const podfileLockLocations = [
    path.join(projectDir, 'Podfile.lock'),
    path.join(path.dirname(projectDir), 'Podfile.lock'), // parent dir (workspace root)
  ];
  
  for (const loc of podfileLockLocations) {
    if (fs.existsSync(loc)) {
      const deps = parsePodfileLock(loc);
      for (const dep of deps) {
        const key = `${dep.name}@${dep.version}`;
        if (!seenPodfiles.has(key)) {
          seenPodfiles.add(key);
          all.push(dep);
        }
      }
    }
  }
  
  // Specific locations for Package.resolved (no recursive scan)
  const packageResolvedLocations = [
    // Inside the .xcodeproj bundle
    path.join(xcprojDir, 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved'),
    // Project directory
    path.join(projectDir, 'Package.resolved'),
    path.join(projectDir, '.swiftpm', 'Package.resolved'),
    // Parent directory (workspace root)
    path.join(path.dirname(projectDir), 'Package.resolved'),
    path.join(path.dirname(projectDir), '.swiftpm', 'Package.resolved'),
  ];
  
  // Also check for workspace-level SPM
  const workspacePath = path.join(projectDir, path.basename(xcprojDir).replace('.xcodeproj', '.xcworkspace'));
  if (fs.existsSync(workspacePath)) {
    packageResolvedLocations.push(
      path.join(workspacePath, 'xcshareddata', 'swiftpm', 'Package.resolved')
    );
  }
  
  for (const loc of packageResolvedLocations) {
    if (fs.existsSync(loc) && !seenPackageResolved.has(loc)) {
      seenPackageResolved.add(loc);
      const deps = parsePackageResolved(loc);
      for (const dep of deps) {
        const key = `${dep.name}@${dep.version}`;
        if (!seenPackageResolved.has(key)) {
          seenPackageResolved.add(key);
          all.push(dep);
        }
      }
    }
  }
  
  return all;
}

/**
 * Loads all dependencies from a project directory
 * BUG FIX #3: Now searches recursively for lockfiles
 * P2-C FIX: When given a .xcodeproj path, uses scoped search to prevent monorepo bleeding
 */
export function loadAllDependencies(projectDir: string): Dependency[] {
  // P2-C FIX: If given a .xcodeproj path directly, use the scoped function
  if (projectDir.endsWith('.xcodeproj')) {
    return loadDependenciesForProject(projectDir);
  }
  
  // Check if this directory contains a single .xcodeproj - if so, scope to it
  try {
    const entries = fs.readdirSync(projectDir);
    const xcodeprojs = entries.filter(e => e.endsWith('.xcodeproj'));
    if (xcodeprojs.length === 1) {
      // Single xcodeproj in directory - use scoped loading
      return loadDependenciesForProject(path.join(projectDir, xcodeprojs[0]));
    }
  } catch {
    // Fall through to recursive search
  }
  
  const all: Dependency[] = [];
  const seenPodfiles = new Set<string>();
  const seenPackageResolved = new Set<string>();
  
  // Find all Podfile.lock files recursively
  const podfileLocks = findFilesRecursive(projectDir, (name) => name === 'Podfile.lock');
  
  // Also check root explicitly (in case of permission issues during recursion)
  const rootPodfileLock = path.join(projectDir, 'Podfile.lock');
  if (fs.existsSync(rootPodfileLock) && !podfileLocks.includes(rootPodfileLock)) {
    podfileLocks.unshift(rootPodfileLock);
  }
  
  for (const podfileLock of podfileLocks) {
    const deps = parsePodfileLock(podfileLock);
    for (const dep of deps) {
      const key = `${dep.name}@${dep.version}`;
      if (!seenPodfiles.has(key)) {
        seenPodfiles.add(key);
        all.push(dep);
      }
    }
  }
  
  // Find all Package.resolved files recursively
  const packageResolvedFiles = findFilesRecursive(
    projectDir, 
    (name) => name === 'Package.resolved'
  );
  
  // Also check common explicit locations
  const explicitLocations = [
    path.join(projectDir, 'Package.resolved'),
    path.join(projectDir, '.swiftpm', 'Package.resolved'),
  ];
  
  for (const loc of explicitLocations) {
    if (fs.existsSync(loc) && !packageResolvedFiles.includes(loc)) {
      packageResolvedFiles.push(loc);
    }
  }
  
  // Also search inside .xcodeproj and .xcworkspace for Package.resolved
  const xcodeBundles = findFilesRecursive(
    projectDir,
    (name) => name.endsWith('.xcodeproj') || name.endsWith('.xcworkspace')
  );
  
  for (const bundle of xcodeBundles) {
    const nestedResolved = path.join(bundle, 'project.xcworkspace', 'xcshareddata', 'swiftpm', 'Package.resolved');
    if (fs.existsSync(nestedResolved) && !packageResolvedFiles.includes(nestedResolved)) {
      packageResolvedFiles.push(nestedResolved);
    }
  }
  
  for (const packageResolved of packageResolvedFiles) {
    const deps = parsePackageResolved(packageResolved);
    for (const dep of deps) {
      const key = `${dep.name}@${dep.version}`;
      if (!seenPackageResolved.has(key)) {
        seenPackageResolved.add(key);
        all.push(dep);
      }
    }
  }
  
  return all;
}
