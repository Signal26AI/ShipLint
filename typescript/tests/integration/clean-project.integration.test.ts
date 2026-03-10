/**
 * Integration test: Clean project baseline
 *
 * A well-configured project that should produce ZERO findings.
 * This validates that the scanner doesn't false-positive on a healthy project.
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan } from '../helpers/integration-runner';

describe('Integration: Clean Project', () => {
  it('should produce no findings for a well-configured project', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('CleanApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withInfoPlistKey('UILaunchStoryboardName', 'LaunchScreen')
        .withInfoPlistKey('UISupportedInterfaceOrientations', [
          'UIInterfaceOrientationPortrait',
          'UIInterfaceOrientationLandscapeLeft',
          'UIInterfaceOrientationLandscapeRight',
        ])
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(result.findings).toHaveLength(0);
      expect(result.rulesRun.length).toBeGreaterThan(0);
      expect(result.projectPath).toBe(fixture.projectDir);
    });
  });

  it('should detect the xcodeproj and parse it successfully', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('CleanApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      // Scanner found our project
      expect(result.projectType).toBe('xcodeproj');
      expect(result.rulesRun.length).toBeGreaterThan(0);
    });
  });
});
