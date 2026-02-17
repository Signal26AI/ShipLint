import * as fs from 'fs';
import * as path from 'path';

const SOURCE_SCAN_SKIP_DIRS = new Set([
  'Pods',
  'Carthage',
  'DerivedData',
  '.build',
  'node_modules',
  'build',
  '.git',
]);

const SOURCE_EXTENSIONS = new Set(['.swift', '.m', '.mm']);

interface LabeledPattern {
  label: string;
  pattern: RegExp;
}

const CAMERA_PATTERNS: LabeledPattern[] = [
  { label: 'AVCaptureSession', pattern: /\bAVCaptureSession\b/ },
  { label: 'AVCaptureDevice', pattern: /\bAVCaptureDevice\b/ },
  { label: 'AVCaptureVideoPreviewLayer', pattern: /\bAVCaptureVideoPreviewLayer\b/ },
  { label: 'AVCapturePhotoOutput', pattern: /\bAVCapturePhotoOutput\b/ },
  { label: 'AVCaptureMovieFileOutput', pattern: /\bAVCaptureMovieFileOutput\b/ },
  { label: 'VNDocumentCameraViewController', pattern: /\bVNDocumentCameraViewController\b/ },
  { label: 'DataScannerViewController', pattern: /\bDataScannerViewController\b/ },
  { label: 'capturePhoto', pattern: /\bcapturePhoto\b/ },
];

const MICROPHONE_PATTERNS: LabeledPattern[] = [
  { label: 'AVAudioRecorder', pattern: /\bAVAudioRecorder\b/ },
  { label: 'SFSpeechRecognizer', pattern: /\bSFSpeechRecognizer\b/ },
  { label: 'SFSpeechAudioBufferRecognitionRequest', pattern: /\bSFSpeechAudioBufferRecognitionRequest\b/ },
  { label: 'AVCaptureAudioDataOutput', pattern: /\bAVCaptureAudioDataOutput\b/ },
];

const PLAYBACK_PATTERNS: LabeledPattern[] = [
  { label: 'AVPlayer', pattern: /\bAVPlayer\b/ },
  { label: 'AVPlayerViewController', pattern: /\bAVPlayerViewController\b/ },
  { label: 'AVPlayerItem', pattern: /\bAVPlayerItem\b/ },
  { label: 'AVAudioPlayer', pattern: /\bAVAudioPlayer\b/ },
  { label: 'AVAudioSession', pattern: /\bAVAudioSession\b/ },
  { label: 'AVAsset', pattern: /\bAVAsset\b/ },
  { label: 'AVURLAsset', pattern: /\bAVURLAsset\b/ },
  { label: 'AVMutableComposition', pattern: /\bAVMutableComposition\b/ },
  { label: 'AVSpeechSynthesizer', pattern: /\bAVSpeechSynthesizer\b/ },
];

const AVFOUNDATION_IMPORT_PATTERNS = [
  /^\s*import\s+AVFoundation\b/m,
  /#import\s*<AVFoundation\/AVFoundation\.h>/,
];

export interface AVSourceUsageSignals {
  hasAVFoundationImport: boolean;
  hasCameraSpecificUsage: boolean;
  hasMicrophoneSpecificUsage: boolean;
  hasPlaybackUsage: boolean;
  cameraEvidence: string[];
  microphoneEvidence: string[];
  playbackEvidence: string[];
}

function findSourceFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!SOURCE_SCAN_SKIP_DIRS.has(entry.name)) {
          walk(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

function collectEvidence(content: string, patterns: LabeledPattern[]): string[] {
  const evidence: string[] = [];

  for (const { label, pattern } of patterns) {
    if (pattern.test(content)) {
      evidence.push(label);
    }
  }

  return evidence;
}

function hasUIImagePickerCameraUsage(content: string): boolean {
  if (!/\bUIImagePickerController\b/.test(content)) {
    return false;
  }

  return (
    /\bsourceType\s*=\s*\.camera\b/.test(content) ||
    /\bsourceType\s*=\s*UIImagePickerController\.SourceType\.camera\b/.test(content) ||
    /\bUIImagePickerController\.SourceType\.camera\b/.test(content) ||
    /\bUIImagePickerControllerSourceTypeCamera\b/.test(content)
  );
}

function hasAVAudioEngineInputNodeUsage(content: string): boolean {
  return /\bAVAudioEngine\b/.test(content) && /\binputNode\b/.test(content);
}

function hasStartRecordingCameraContext(content: string): boolean {
  if (!/\bstartRecording\b/.test(content)) {
    return false;
  }

  return /\b(AVCapture|VNDocumentCameraViewController|DataScannerViewController|UIImagePickerController|camera)\b/i.test(content);
}

function hasStartRecordingAudioContext(content: string): boolean {
  if (!/\bstartRecording\b/.test(content)) {
    return false;
  }

  return /\b(AVAudio|AVCaptureAudio|SFSpeech|microphone|audio)\b/i.test(content);
}

export function stripComments(source: string): string {
  return source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function detectAVSourceUsage(projectPath: string): AVSourceUsageSignals {
  const sourceFiles = findSourceFiles(projectPath);

  let hasAVFoundationImport = false;
  const cameraEvidence = new Set<string>();
  const microphoneEvidence = new Set<string>();
  const playbackEvidence = new Set<string>();

  for (const file of sourceFiles) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    content = stripComments(content);

    if (!hasAVFoundationImport) {
      hasAVFoundationImport = AVFOUNDATION_IMPORT_PATTERNS.some((pattern) => pattern.test(content));
    }

    for (const evidence of collectEvidence(content, CAMERA_PATTERNS)) {
      cameraEvidence.add(evidence);
    }

    if (hasUIImagePickerCameraUsage(content)) {
      cameraEvidence.add('UIImagePickerController(.camera)');
    }

    if (hasStartRecordingCameraContext(content)) {
      cameraEvidence.add('startRecording (camera context)');
    }

    for (const evidence of collectEvidence(content, MICROPHONE_PATTERNS)) {
      microphoneEvidence.add(evidence);
    }

    if (hasAVAudioEngineInputNodeUsage(content)) {
      microphoneEvidence.add('AVAudioEngine.inputNode');
    }

    if (hasStartRecordingAudioContext(content)) {
      microphoneEvidence.add('startRecording (audio context)');
    }

    for (const evidence of collectEvidence(content, PLAYBACK_PATTERNS)) {
      playbackEvidence.add(evidence);
    }
  }

  return {
    hasAVFoundationImport,
    hasCameraSpecificUsage: cameraEvidence.size > 0,
    hasMicrophoneSpecificUsage: microphoneEvidence.size > 0,
    hasPlaybackUsage: playbackEvidence.size > 0,
    cameraEvidence: Array.from(cameraEvidence),
    microphoneEvidence: Array.from(microphoneEvidence),
    playbackEvidence: Array.from(playbackEvidence),
  };
}
