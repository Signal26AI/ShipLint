/**
 * Integration test: Missing Privacy Manifest
 *
 * A project that uses Firebase (via CocoaPods) but has no PrivacyInfo.xcprivacy.
 * Should trigger: metadata-001-missing-privacy-manifest
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan, hasFinding, hasNoFinding } from '../helpers/integration-runner';

const RULE_ID = 'metadata-001-missing-privacy-manifest';

describe('Integration: Missing Privacy Manifest', () => {
  it('should flag a project using Firebase without PrivacyInfo.xcprivacy', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('FirebaseApp')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPodDependency('Firebase', '10.22.0')
        .withPodDependency('FirebaseAnalytics', '10.22.0')
        // No .withPrivacyManifest() — that's the point
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);

      // Verify the finding content is sensible
      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.title).toContain('Privacy Manifest');
      expect(finding.description).toContain('Firebase');
    });
  });

  it('should NOT flag a project using Firebase WITH a privacy manifest', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('FirebaseAppClean')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPodDependency('Firebase', '10.22.0')
        .withPodDependency('FirebaseAnalytics', '10.22.0')
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });
});
