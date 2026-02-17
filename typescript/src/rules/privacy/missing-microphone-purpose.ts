/**
 * Rule: Missing Microphone Usage Description
 *
 * Detects when an app uses audio recording frameworks without the required
 * NSMicrophoneUsageDescription in Info.plist.
 *
 * App Store Review Guideline: 5.1.1
 */
import type { Rule, Finding, ScanContext } from '../../types/index.js';
import { Severity, Confidence, RuleCategory } from '../../types/index.js';
import { isPlaceholder } from '../../parsers/plist-parser.js';
import { makeFinding, makeCustomFinding } from '../base.js';
import { detectAVSourceUsage } from './av-source-usage.js';

// Frameworks that strongly imply microphone usage
const MICROPHONE_FRAMEWORKS = ['AVFAudio', 'Speech'];
const MICROPHONE_KEY = 'NSMicrophoneUsageDescription';
const SPEECH_KEY = 'NSSpeechRecognitionUsageDescription';

export const MissingMicrophonePurposeRule: Rule = {
  id: 'privacy-005-missing-microphone-purpose',
  name: 'Missing Microphone Usage Description',
  description: 'Checks for audio recording framework usage without NSMicrophoneUsageDescription',
  category: RuleCategory.Privacy,
  severity: Severity.Critical,
  confidence: Confidence.High,
  guidelineReference: '5.1.1',

  async evaluate(context: ScanContext): Promise<Finding[]> {
    // Framework/library targets do not need app-level usage descriptions
    if (context.isFrameworkTarget()) {
      return [];
    }

    const detectedFrameworks = MICROPHONE_FRAMEWORKS.filter((framework) => context.hasFramework(framework));
    const hasAVFoundation = context.hasFramework('AVFoundation');
    const hasOnlyAVFoundation = hasAVFoundation && detectedFrameworks.length === 0;

    const sourceUsage = detectAVSourceUsage(context.projectPath);
    const hasMicrophoneSpecificUsage = sourceUsage.hasMicrophoneSpecificUsage;
    const hasCameraSpecificUsage = sourceUsage.hasCameraSpecificUsage;

    const hasPlaybackOnlyUsage =
      sourceUsage.hasPlaybackUsage &&
      !hasMicrophoneSpecificUsage &&
      !hasCameraSpecificUsage;

    if (detectedFrameworks.length === 0 && !hasAVFoundation && !hasMicrophoneSpecificUsage) {
      return [];
    }

    // AVFoundation-only projects that only use playback (or camera-only APIs)
    // should not be flagged for microphone permission.
    // AVFoundation-only: skip if we found source files and none use mic APIs
    const hasAnySourceSignal = sourceUsage.hasAVFoundationImport || sourceUsage.hasPlaybackUsage || sourceUsage.hasCameraSpecificUsage;
    if (hasOnlyAVFoundation && !hasMicrophoneSpecificUsage && !hasCameraSpecificUsage && hasAnySourceSignal) {
      return [];
    }

    const findings: Finding[] = [];
    const microphoneDescription = context.plistString(MICROPHONE_KEY);
    const speechDescription = context.plistString(SPEECH_KEY);

    // If Speech framework is linked, check for speech recognition description
    if (context.hasFramework('Speech')) {
      if (speechDescription === undefined) {
        findings.push(makeFinding(this, {
          title: 'Missing Speech Recognition Usage Description',
          description:
            `Your app links against the Speech framework but Info.plist is missing ` +
            `NSSpeechRecognitionUsageDescription. Apps using speech recognition must provide a ` +
            `purpose string explaining why access is needed.`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance:
            `Add NSSpeechRecognitionUsageDescription to your Info.plist:\n\n` +
            `<key>NSSpeechRecognitionUsageDescription</key>\n` +
            `<string>We use speech recognition to transcribe your voice notes.</string>\n\n` +
            `Note: You'll also need NSMicrophoneUsageDescription since speech recognition requires microphone access.`,
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      } else if (speechDescription.trim() === '') {
        findings.push(makeFinding(this, {
          title: 'Empty Speech Recognition Usage Description',
          description: 'NSSpeechRecognitionUsageDescription exists but is empty.',
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: 'Provide a meaningful description for speech recognition usage.',
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      } else if (isPlaceholder(speechDescription)) {
        findings.push(makeFinding(this, {
          title: 'Placeholder Speech Recognition Usage Description',
          description: `NSSpeechRecognitionUsageDescription contains placeholder text: "${speechDescription}".`,
          location: context.infoPlistPath || 'Info.plist',
          fixGuidance: 'Replace the placeholder with a real description of your speech recognition feature.',
          documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsspeechrecognitionusagedescription',
        }));
      }
    }

    // Camera capture APIs (AVCaptureSession etc.) almost always record audio too
    const impliesMicrophone = hasMicrophoneSpecificUsage || hasCameraSpecificUsage;

    const confidenceLevel = impliesMicrophone
      ? Confidence.High
      : hasOnlyAVFoundation
        ? Confidence.Medium
        : Confidence.High;

    const findingSeverity = impliesMicrophone
      ? Severity.Critical
      : hasOnlyAVFoundation
        ? Severity.Medium
        : this.severity;

    const frameworksToReport = hasAVFoundation
      ? [...detectedFrameworks, 'AVFoundation']
      : detectedFrameworks;

    const reportSource = frameworksToReport.length > 0
      ? frameworksToReport.join(', ')
      : 'source analysis';

    const sourceEvidence = hasMicrophoneSpecificUsage && sourceUsage.microphoneEvidence.length > 0
      ? ` Source analysis detected microphone APIs: ${sourceUsage.microphoneEvidence.slice(0, 3).join(', ')}.`
      : '';

    const avFoundationCaveat = hasOnlyAVFoundation && !hasMicrophoneSpecificUsage
      ? `\n\nNote: AVFoundation is commonly used for audio/video playback. If your app only plays ` +
        `media and doesn't record audio, you may not need this permission.`
      : '';

    // Case 1: Completely missing microphone description
    if (microphoneDescription === undefined) {
      findings.push(makeCustomFinding(this, findingSeverity, confidenceLevel, {
        title: 'Missing Microphone Usage Description',
        description:
          `Your app links against audio frameworks (${reportSource}) ` +
          `but Info.plist is missing NSMicrophoneUsageDescription. Apps that access the microphone ` +
          `must provide a purpose string explaining why access is needed.${sourceEvidence}${avFoundationCaveat}`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance:
          `Add NSMicrophoneUsageDescription to your Info.plist with a clear, user-facing explanation ` +
          `of why your app needs microphone access. For example:\n\n` +
          `<key>NSMicrophoneUsageDescription</key>\n` +
          `<string>We need microphone access to record voice messages and make calls.</string>\n\n` +
          `The description should explain the specific feature that uses the microphone.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }
    // Case 2: Empty description
    else if (microphoneDescription.trim() === '') {
      findings.push(makeCustomFinding(this, findingSeverity, confidenceLevel, {
        title: 'Empty Microphone Usage Description',
        description:
          `NSMicrophoneUsageDescription exists in Info.plist but is empty. ` +
          `Apple requires a meaningful description explaining why your app needs microphone access.${avFoundationCaveat}`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance:
          `Update NSMicrophoneUsageDescription with a clear, specific explanation of why your app ` +
          `needs microphone access. Generic or empty descriptions will be rejected.\n\n` +
          `Good example: "Record audio for your video messages."\n` +
          `Bad example: "Microphone access required" or ""`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }
    // Case 3: Placeholder text detected
    else if (isPlaceholder(microphoneDescription)) {
      findings.push(makeCustomFinding(this, findingSeverity, confidenceLevel, {
        title: 'Placeholder Microphone Usage Description',
        description:
          `NSMicrophoneUsageDescription appears to contain placeholder text: "${microphoneDescription}". ` +
          `Apple requires meaningful, user-facing descriptions.${avFoundationCaveat}`,
        location: context.infoPlistPath || 'Info.plist',
        fixGuidance:
          `Replace the placeholder text with a clear explanation of why your app needs microphone access. ` +
          `The description should be specific to your app's features.\n\n` +
          `Current value: "${microphoneDescription}"\n\n` +
          `Write a description that helps users understand what feature uses the microphone and why.`,
        documentationURL: 'https://developer.apple.com/documentation/bundleresources/information_property_list/nsmicrophoneusagedescription',
      }));
    }

    return findings;
  },
};
