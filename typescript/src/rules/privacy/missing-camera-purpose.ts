/**
 * Rule: Missing Camera Usage Description
 *
 * Detects when an app uses camera-related frameworks but is missing
 * the required NSCameraUsageDescription in Info.plist.
 *
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeCustomFinding } from '../base.js';
import { detectAVSourceUsage } from './av-source-usage.js';

// Note: VisionKit is NOT included as a framework-level trigger because it can be
// used for non-camera features (e.g. ImageAnalyzer). Camera-specific VisionKit APIs
// are detected via source analysis.
const CAMERA_SPECIFIC_FRAMEWORKS = ['AVKit'];
const CAMERA_FRAMEWORKS = ['AVFoundation', ...CAMERA_SPECIFIC_FRAMEWORKS];

export const MissingCameraPurposeRule: Rule = {
  id: 'privacy-001-missing-camera-purpose',
  name: 'Missing Camera Usage Description',
  description: 'Checks for camera framework usage without NSCameraUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }

    const detectedFrameworks = CAMERA_FRAMEWORKS.filter((framework) => context.hasFramework(framework));
    const hasOnlyAVFoundation = detectedFrameworks.length === 1 && detectedFrameworks[0] === 'AVFoundation';

    const sourceUsage = detectAVSourceUsage(context.projectPath);
    const hasCameraSpecificUsage = sourceUsage.hasCameraSpecificUsage;
    const hasMicrophoneSpecificUsage = sourceUsage.hasMicrophoneSpecificUsage;

    const hasPlaybackOnlyUsage =
      sourceUsage.hasPlaybackUsage &&
      !hasCameraSpecificUsage &&
      !hasMicrophoneSpecificUsage;

    // No framework signal and no camera APIs in source: rule doesn't apply.
    if (detectedFrameworks.length === 0 && !hasCameraSpecificUsage) {
      return [];
    }

    // AVFoundation-only: only skip if we positively detected playback-only usage
    if (hasOnlyAVFoundation && !hasCameraSpecificUsage && hasPlaybackOnlyUsage) {
      return [];
    }

    const confidenceLevel = hasCameraSpecificUsage
      ? Confidence.High
      : hasOnlyAVFoundation
        ? Confidence.Medium
        : Confidence.High;

    const severityLevel = hasCameraSpecificUsage || !hasOnlyAVFoundation
      ? Severity.Critical
      : Severity.Medium;

    const sourceEvidence = hasCameraSpecificUsage && sourceUsage.cameraEvidence.length > 0
      ? ` Source analysis detected camera APIs: ${sourceUsage.cameraEvidence.slice(0, 3).join(', ')}.`
      : '';

    const frameworksToReport = detectedFrameworks.length > 0
      ? detectedFrameworks.join(', ')
      : 'source analysis';

    const avFoundationCaveat = hasOnlyAVFoundation && !hasCameraSpecificUsage
      ? '\n\nNote: AVFoundation is commonly used for audio/video playback. If your app only plays media and doesn\'t capture photos or video, you may not need this permission.'
      : '';

    const cameraDescription = context.plistString('NSCameraUsageDescription');

    // Case 1: Completely missing
    if (cameraDescription === undefined) {
      return [
        makeCustomFinding(this, severityLevel, confidenceLevel, {
          title: 'Missing Camera Usage Description',
          description:
            `Your app links against camera-related frameworks (${frameworksToReport}) ` +
            `but Info.plist is missing NSCameraUsageDescription. Apps that access the camera must ` +
            `provide a purpose string explaining why access is needed.${sourceEvidence}${avFoundationCaveat}`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance:
            `Add NSCameraUsageDescription to your Info.plist with a clear, user-facing explanation ` +
            `of why your app needs camera access. For example:\n\n` +
            `<key>NSCameraUsageDescription</key>\n` +
            `<string>We need access to your camera to take photos for your profile.</string>\n\n` +
            `The description should explain the specific feature that uses the camera and ` +
            `be written from the user's perspective.`,
          shortFixText: 'Add NSCameraUsageDescription to Info.plist explaining why your app needs camera access',
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // Case 2: Empty or whitespace only
    if (cameraDescription.trim() === '') {
      return [
        makeCustomFinding(this, severityLevel, confidenceLevel, {
          title: 'Empty Camera Usage Description',
          description:
            `NSCameraUsageDescription exists in Info.plist but is empty. ` +
            `Apple requires a meaningful description explaining why your app needs camera access.${avFoundationCaveat}`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance:
            `Update NSCameraUsageDescription with a clear, specific explanation of why your app ` +
            `needs camera access. Generic or empty descriptions may be rejected.\n\n` +
            `Good example: "We use your camera to scan QR codes for quick login."\n` +
            `Bad example: "Camera access required" or ""`,
          shortFixText: 'Replace the empty NSCameraUsageDescription with a meaningful explanation of camera usage',
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // Case 3: Placeholder text detected
    if (isPlaceholder(cameraDescription)) {
      return [
        makeCustomFinding(this, severityLevel, confidenceLevel, {
          title: 'Placeholder Camera Usage Description',
          description:
            `NSCameraUsageDescription appears to contain placeholder text: "${cameraDescription}". ` +
            `Apple requires meaningful, user-facing descriptions.${avFoundationCaveat}`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance:
            `Replace the placeholder text with a clear explanation of why your app needs camera access. ` +
            `The description should be specific to your app's features.\n\n` +
            `Current value: "${cameraDescription}"\n\n` +
            `Write a description that helps users understand what feature uses the camera and why.`,
          shortFixText: 'Replace the placeholder NSCameraUsageDescription with a real explanation of camera usage',
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription',
        }),
      ];
    }

    // All checks passed
    return [];
  },
};
