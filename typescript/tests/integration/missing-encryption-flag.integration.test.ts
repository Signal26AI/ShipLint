/**
 * Integration test: Missing Encryption Flag
 *
 * A project whose Info.plist is missing ITSAppUsesNonExemptEncryption.
 * Should trigger: config-002-missing-encryption-flag
 */
import { FixtureBuilder } from '../helpers/fixture-builder';
import { withFixture, runScan, hasFinding, hasNoFinding } from '../helpers/integration-runner';

const RULE_ID = 'config-002-missing-encryption-flag';

describe('Integration: Missing Encryption Flag', () => {
  it('should flag a project without ITSAppUsesNonExemptEncryption', async () => {
    await withFixture(async (tmpDir) => {
      // Don't set ITSAppUsesNonExemptEncryption — that's the bug
      const fixture = new FixtureBuilder('NoEncryptionApp')
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasFinding(result, RULE_ID)).toBe(true);

      const finding = result.findings.find((f) => f.ruleId === RULE_ID)!;
      expect(finding.description).toContain('ITSAppUsesNonExemptEncryption');
    });
  });

  it('should NOT flag when ITSAppUsesNonExemptEncryption is set to false', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('EncryptionDeclared')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', false)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });

  it('should NOT flag when ITSAppUsesNonExemptEncryption is set to true', async () => {
    await withFixture(async (tmpDir) => {
      const fixture = new FixtureBuilder('EncryptionTrue')
        .withInfoPlistKey('ITSAppUsesNonExemptEncryption', true)
        .withPrivacyManifest()
        .build(tmpDir);

      const result = await runScan(fixture.projectDir);

      expect(hasNoFinding(result, RULE_ID)).toBe(true);
    });
  });
});
