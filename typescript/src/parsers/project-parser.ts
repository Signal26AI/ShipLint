/**
 * Parser for Xcode project structure
 */
import * as fs from 'fs';
import * as path from 'path';
import { parsePlist } from './plist-parser.js';
import { parseEntitlements } from './entitlements-parser.js';
import { parseProjectFrameworks, loadAllDependencies } from './framework-detector.js';
import type { Dependency, ScanContext } from '../types/index.js';

/**
 * Result of project discovery
 */
export interface ProjectDiscovery {
  projectPath: string;
  infoPlistPath?: string;
  entitlementsPath?: string;
  pbxprojPath?: string;
  isWorkspace: boolean;
}

/**
 * Maximum depth for recursive directory searches
 */
const MAX_SEARCH_DEPTH = 5;

/**
 * Recursively find files matching a pattern
 */
function findFilesRecursive(
  dir: string,
  predicate: (name: string, fullPath: string) => boolean,
  maxDepth: number = MAX_SEARCH_DEPTH,
  currentDepth: number = 0
): string[] {
  if (currentDepth >= maxDepth) return [];
  
  const results: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir);
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      
      // Skip common non-project directories for performance
      if (entry === 'node_modules' || entry === '.git' || entry === 'Pods' || 
          entry === 'build' || entry === 'DerivedData' || entry === '.build') {
        continue;
      }
      
      if (predicate(entry, fullPath)) {
        results.push(fullPath);
      }
      
      // Recurse into directories (but not into .xcodeproj/.xcworkspace bundles)
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && 
            !entry.endsWith('.xcodeproj') && 
            !entry.endsWith('.xcworkspace') &&
            !entry.endsWith('.app') &&
            !entry.endsWith('.framework')) {
          results.push(...findFilesRecursive(fullPath, predicate, maxDepth, currentDepth + 1));
        }
      } catch {
        // Ignore stat errors (permissions, etc.)
      }
    }
  } catch {
    // Ignore readdir errors
  }
  
  return results;
}

/**
 * Discovers project files in a directory
 */
export function discoverProject(inputPath: string): ProjectDiscovery {
  const stat = fs.statSync(inputPath);
  
  if (stat.isFile() && inputPath.endsWith('.ipa')) {
    throw new Error('IPA scanning is not yet supported. Please extract the IPA and point to the extracted app.');
  }
  
  // BUG FIX #1: Handle direct .xcodeproj path
  // If the input IS a .xcodeproj directory, use it directly
  if (stat.isDirectory() && inputPath.endsWith('.xcodeproj')) {
    const pbxprojPath = path.join(inputPath, 'project.pbxproj');
    const basePath = path.dirname(inputPath);
    
    const discovery: ProjectDiscovery = {
      projectPath: basePath,
      isWorkspace: false,
    };
    
    if (fs.existsSync(pbxprojPath)) {
      discovery.pbxprojPath = pbxprojPath;
    }
    
    // Still look for Info.plist and entitlements in parent directory
    discoverInfoPlist(basePath, discovery);
    discoverEntitlements(basePath, discovery);
    
    return discovery;
  }
  
  // Handle .xcworkspace path similarly
  if (stat.isDirectory() && inputPath.endsWith('.xcworkspace')) {
    const basePath = path.dirname(inputPath);
    
    const discovery: ProjectDiscovery = {
      projectPath: basePath,
      isWorkspace: true,
    };
    
    // Look for .xcodeproj siblings
    const xcodeprojs = findFilesRecursive(basePath, (name) => name.endsWith('.xcodeproj'), 2);
    for (const xcodeprojPath of xcodeprojs) {
      const pbxprojPath = path.join(xcodeprojPath, 'project.pbxproj');
      if (fs.existsSync(pbxprojPath)) {
        discovery.pbxprojPath = pbxprojPath;
        break;
      }
    }
    
    discoverInfoPlist(basePath, discovery);
    discoverEntitlements(basePath, discovery);
    
    return discovery;
  }
  
  const basePath = stat.isDirectory() ? inputPath : path.dirname(inputPath);
  
  const discovery: ProjectDiscovery = {
    projectPath: basePath,
    isWorkspace: false,
  };
  
  // BUG FIX #3: Recursive search for xcworkspace and xcodeproj
  const xcworkspaces = findFilesRecursive(basePath, (name) => name.endsWith('.xcworkspace'));
  if (xcworkspaces.length > 0) {
    discovery.isWorkspace = true;
  }
  
  const xcodeprojs = findFilesRecursive(basePath, (name) => name.endsWith('.xcodeproj'));
  for (const xcodeprojPath of xcodeprojs) {
    const pbxprojPath = path.join(xcodeprojPath, 'project.pbxproj');
    if (fs.existsSync(pbxprojPath)) {
      discovery.pbxprojPath = pbxprojPath;
      break;
    }
  }
  
  discoverInfoPlist(basePath, discovery);
  discoverEntitlements(basePath, discovery);
  
  return discovery;
}

/**
 * Discovers Info.plist in project directory (recursive)
 */
function discoverInfoPlist(basePath: string, discovery: ProjectDiscovery): void {
  // First check root
  const rootPlist = path.join(basePath, 'Info.plist');
  if (fs.existsSync(rootPlist)) {
    discovery.infoPlistPath = rootPlist;
    return;
  }
  
  // Recursive search
  const plists = findFilesRecursive(basePath, (name) => name === 'Info.plist');
  if (plists.length > 0) {
    // Prefer shorter paths (closer to root)
    plists.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
    discovery.infoPlistPath = plists[0];
  }
}

/**
 * Discovers entitlements file in project directory (recursive)
 */
function discoverEntitlements(basePath: string, discovery: ProjectDiscovery): void {
  const entitlements = findFilesRecursive(basePath, (name) => name.endsWith('.entitlements'));
  if (entitlements.length > 0) {
    // Prefer shorter paths (closer to root)
    entitlements.sort((a, b) => a.split(path.sep).length - b.split(path.sep).length);
    discovery.entitlementsPath = entitlements[0];
  }
}

/**
 * Creates a scan context from discovered project
 */
export function createScanContext(discovery: ProjectDiscovery): ScanContext {
  let infoPlist: Record<string, unknown> = {};
  let entitlements: Record<string, unknown> = {};
  let linkedFrameworks = new Set<string>();
  let dependencies: Dependency[] = [];
  
  // Parse Info.plist
  if (discovery.infoPlistPath) {
    try {
      infoPlist = parsePlist(discovery.infoPlistPath);
    } catch (error) {
      console.warn(`Warning: Could not parse Info.plist: ${error}`);
    }
  }
  
  // Parse entitlements
  if (discovery.entitlementsPath) {
    try {
      entitlements = parseEntitlements(discovery.entitlementsPath);
    } catch (error) {
      console.warn(`Warning: Could not parse entitlements: ${error}`);
    }
  }
  
  // Parse frameworks from pbxproj
  if (discovery.pbxprojPath) {
    try {
      linkedFrameworks = parseProjectFrameworks(discovery.pbxprojPath);
    } catch (error) {
      console.warn(`Warning: Could not parse project frameworks: ${error}`);
    }
  }
  
  // Load dependencies
  try {
    dependencies = loadAllDependencies(discovery.projectPath);
  } catch (error) {
    console.warn(`Warning: Could not load dependencies: ${error}`);
  }
  
  return createContextObject(
    discovery.projectPath,
    infoPlist,
    entitlements,
    linkedFrameworks,
    dependencies
  );
}

/**
 * Creates a ScanContext object with helper methods
 */
export function createContextObject(
  projectPath: string,
  infoPlist: Record<string, unknown>,
  entitlements: Record<string, unknown>,
  linkedFrameworks: Set<string>,
  dependencies: Dependency[]
): ScanContext {
  return {
    projectPath,
    infoPlist,
    entitlements,
    linkedFrameworks,
    dependencies,
    
    plistString(key: string): string | undefined {
      const value = this.infoPlist[key];
      return typeof value === 'string' ? value : undefined;
    },
    
    plistArray(key: string): unknown[] | undefined {
      const value = this.infoPlist[key];
      return Array.isArray(value) ? value : undefined;
    },
    
    plistBool(key: string): boolean | undefined {
      const value = this.infoPlist[key];
      return typeof value === 'boolean' ? value : undefined;
    },
    
    hasPlistKey(key: string): boolean {
      return key in this.infoPlist;
    },
    
    hasFramework(name: string): boolean {
      return this.linkedFrameworks.has(name);
    },
    
    hasEntitlement(key: string): boolean {
      return key in this.entitlements;
    },
    
    entitlementString(key: string): string | undefined {
      const value = this.entitlements[key];
      return typeof value === 'string' ? value : undefined;
    },
    
    entitlementArray(key: string): unknown[] | undefined {
      const value = this.entitlements[key];
      return Array.isArray(value) ? value : undefined;
    },
  };
}
