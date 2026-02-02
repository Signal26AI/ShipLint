/**
 * Rules module - exports all rules and registry
 */
import type { Rule } from '../types/index.js';

// Privacy rules
export * from './privacy/index.js';

// Auth rules
export * from './auth/index.js';

// Metadata rules
export * from './metadata/index.js';

// Config rules
export * from './config/index.js';

// Base utilities
export * from './base.js';

// Import all rules for registry
import { MissingCameraPurposeRule } from './privacy/missing-camera-purpose.js';
import { MissingLocationPurposeRule } from './privacy/missing-location-purpose.js';
import { LocationAlwaysUnjustifiedRule } from './privacy/location-always-unjustified.js';
import { ATTTrackingMismatchRule } from './privacy/att-tracking-mismatch.js';
import { MissingPhotoLibraryPurposeRule } from './privacy/missing-photo-library-purpose.js';
import { MissingMicrophonePurposeRule } from './privacy/missing-microphone-purpose.js';
import { MissingContactsPurposeRule } from './privacy/missing-contacts-purpose.js';
import { ThirdPartyLoginNoSIWARule } from './auth/third-party-login-no-siwa.js';
import { MissingPrivacyManifestRule } from './metadata/missing-privacy-manifest.js';
import { ATSExceptionWithoutJustificationRule } from './config/ats-exception-without-justification.js';

/**
 * All available rules
 */
export const allRules: Rule[] = [
  MissingCameraPurposeRule,
  MissingLocationPurposeRule,
  LocationAlwaysUnjustifiedRule,
  ATTTrackingMismatchRule,
  MissingPhotoLibraryPurposeRule,
  MissingMicrophonePurposeRule,
  MissingContactsPurposeRule,
  ThirdPartyLoginNoSIWARule,
  MissingPrivacyManifestRule,
  ATSExceptionWithoutJustificationRule,
];

/**
 * Rule registry - maps rule IDs to rule instances
 */
export const ruleRegistry: Map<string, Rule> = new Map(
  allRules.map(rule => [rule.id, rule])
);

/**
 * Get a rule by ID
 */
export function getRule(id: string): Rule | undefined {
  return ruleRegistry.get(id);
}

/**
 * Get rules by IDs (returns all if no IDs specified)
 */
export function getRules(ids?: string[]): Rule[] {
  if (!ids || ids.length === 0) {
    return allRules;
  }
  
  return ids
    .map(id => ruleRegistry.get(id))
    .filter((rule): rule is Rule => rule !== undefined);
}

/**
 * Get rules excluding specified IDs
 */
export function getRulesExcluding(excludeIds: string[]): Rule[] {
  const excludeSet = new Set(excludeIds);
  return allRules.filter(rule => !excludeSet.has(rule.id));
}
