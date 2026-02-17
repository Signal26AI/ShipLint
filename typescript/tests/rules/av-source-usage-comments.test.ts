/**
 * Tests for comment stripping in AV source usage detection
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { detectAVSourceUsage, stripComments } from '../../src/rules/privacy/av-source-usage';

describe('stripComments', () => {
  it('should remove single-line comments', () => {
    const input = '// import AVFoundation\nlet x = 1';
    expect(stripComments(input)).toBe('\nlet x = 1');
  });

  it('should remove block comments', () => {
    const input = '/* import AVFoundation */\nlet x = 1';
    expect(stripComments(input)).toBe('\nlet x = 1');
  });

  it('should remove multi-line block comments', () => {
    const input = '/*\nimport AVFoundation\nimport UIKit\n*/\nlet x = 1';
    expect(stripComments(input)).toBe('\nlet x = 1');
  });

  it('should preserve non-comment code', () => {
    const input = 'import AVFoundation\nlet x = AVCaptureSession()';
    expect(stripComments(input)).toBe(input);
  });
});

describe('detectAVSourceUsage with comments', () => {
  const tempDirs: string[] = [];

  function createTempProject(swiftContent: string): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shiplint-av-comments-'));
    const sourcePath = path.join(tempDir, 'Source.swift');
    fs.writeFileSync(sourcePath, swiftContent, 'utf-8');
    tempDirs.push(tempDir);
    return tempDir;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should NOT detect AVFoundation import in single-line comment', () => {
    const projectPath = createTempProject('// import AVFoundation\nlet x = 1\n');
    const result = detectAVSourceUsage(projectPath);
    expect(result.hasAVFoundationImport).toBe(false);
  });

  it('should NOT detect AVFoundation import in block comment', () => {
    const projectPath = createTempProject('/* import AVFoundation */\nlet x = 1\n');
    const result = detectAVSourceUsage(projectPath);
    expect(result.hasAVFoundationImport).toBe(false);
  });

  it('should NOT detect AVFoundation import in multi-line block comment', () => {
    const projectPath = createTempProject('/*\nimport AVFoundation\n*/\nlet x = 1\n');
    const result = detectAVSourceUsage(projectPath);
    expect(result.hasAVFoundationImport).toBe(false);
  });

  it('should still detect normal AVFoundation import', () => {
    const projectPath = createTempProject('import AVFoundation\nlet session = AVCaptureSession()\n');
    const result = detectAVSourceUsage(projectPath);
    expect(result.hasAVFoundationImport).toBe(true);
  });
});
