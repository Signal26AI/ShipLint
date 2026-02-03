/**
 * Tests for scanner.ts
 * Covers bug fix #2: Silent rule filtering on typos
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scan, InvalidRulesError, NoRulesError } from '../../src/core/scanner';
import { allRules } from '../../src/rules';

describe('scan', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewshield-scan-test-'));
    // Create minimal project structure
    const xcodeprojDir = path.join(tempDir, 'MyApp.xcodeproj');
    fs.mkdirSync(xcodeprojDir);
    fs.writeFileSync(path.join(xcodeprojDir, 'project.pbxproj'), '// minimal project');
    fs.writeFileSync(path.join(tempDir, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.example.test</string>
</dict>
</plist>`);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Bug Fix #2: Rule validation', () => {
    it('should throw InvalidRulesError for unknown rule IDs', async () => {
      await expect(
        scan({
          path: tempDir,
          rules: ['privacy-001-typo', 'nonexistent-rule'],
        })
      ).rejects.toThrow(InvalidRulesError);
    });

    it('should include unknown IDs in error message', async () => {
      try {
        await scan({
          path: tempDir,
          rules: ['privacy-001-missing-camera-purpose', 'typo-rule', 'another-typo'],
        });
        fail('Expected InvalidRulesError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRulesError);
        const invalidError = error as InvalidRulesError;
        expect(invalidError.unknownIds).toContain('typo-rule');
        expect(invalidError.unknownIds).toContain('another-typo');
        expect(invalidError.unknownIds).not.toContain('privacy-001-missing-camera-purpose');
      }
    });

    it('should include available rule IDs in error message', async () => {
      try {
        await scan({
          path: tempDir,
          rules: ['bad-rule-id'],
        });
        fail('Expected InvalidRulesError');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidRulesError);
        const invalidError = error as InvalidRulesError;
        expect(invalidError.availableIds).toContain('privacy-001-missing-camera-purpose');
        expect(invalidError.message).toContain('Available rules:');
      }
    });

    it('should throw NoRulesError when all rules excluded', async () => {
      const allRuleIds = allRules.map(r => r.id);
      
      await expect(
        scan({
          path: tempDir,
          exclude: allRuleIds,
        })
      ).rejects.toThrow(NoRulesError);
    });

    it('should run successfully with valid rule IDs', async () => {
      const result = await scan({
        path: tempDir,
        rules: ['privacy-001-missing-camera-purpose'],
      });

      expect(result.rulesRun).toContain('privacy-001-missing-camera-purpose');
      expect(result.rulesRun).toHaveLength(1);
    });

    it('should run all rules when no filter specified', async () => {
      const result = await scan({
        path: tempDir,
      });

      expect(result.rulesRun.length).toBe(allRules.length);
    });

    it('should correctly exclude rules', async () => {
      const result = await scan({
        path: tempDir,
        exclude: ['privacy-001-missing-camera-purpose'],
      });

      expect(result.rulesRun).not.toContain('privacy-001-missing-camera-purpose');
      expect(result.rulesRun.length).toBe(allRules.length - 1);
    });
  });

  describe('Scan execution', () => {
    it('should return scan result with timing info', async () => {
      const result = await scan({
        path: tempDir,
      });

      expect(result.projectPath).toBe(tempDir);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return findings array (possibly empty)', async () => {
      const result = await scan({
        path: tempDir,
      });

      expect(Array.isArray(result.findings)).toBe(true);
    });
  });
});
