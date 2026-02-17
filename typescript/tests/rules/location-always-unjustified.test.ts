import { LocationAlwaysUnjustifiedRule } from '../../src/rules/privacy/location-always-unjustified';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity } from '../../src/types';

describe('LocationAlwaysUnjustifiedRule', () => {
  it('uses High severity (not Critical) for uncertain Always-location misconfiguration', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'We use your location',
      },
      {},
      new Set(['CoreLocation']),
      []
    );

    const findings = await LocationAlwaysUnjustifiedRule.evaluate(context);

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe(Severity.High);
  });
});
