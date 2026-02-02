/**
 * Tests for MissingContactsPurposeRule
 */
import { MissingContactsPurposeRule } from '../../src/rules/privacy/missing-contacts-purpose';
import { createContextObject } from '../../src/parsers/project-parser';
import { Severity, Confidence } from '../../src/types';

describe('MissingContactsPurposeRule', () => {
  it('should return no findings when no Contacts framework is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['UIKit', 'Foundation']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should find missing NSContactsUsageDescription when Contacts is linked', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Contacts']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-006-missing-contacts-purpose');
    expect(findings[0].severity).toBe(Severity.Critical);
    expect(findings[0].confidence).toBe(Confidence.High);
  });

  it('should find empty NSContactsUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSContactsUsageDescription: '',
      },
      {},
      new Set(['Contacts']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Empty Contacts Usage Description');
  });

  it('should find placeholder NSContactsUsageDescription', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSContactsUsageDescription: 'TODO',
      },
      {},
      new Set(['Contacts']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toBe('Placeholder Contacts Usage Description');
  });

  it('should return no findings when valid description exists', async () => {
    const context = createContextObject(
      '/test/project',
      {
        CFBundleIdentifier: 'com.example.app',
        NSContactsUsageDescription: 'We use your contacts to help you find friends who are also using the app.',
      },
      {},
      new Set(['Contacts']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toEqual([]);
  });

  it('should detect ContactsUI as a contacts framework', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['ContactsUI']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('privacy-006-missing-contacts-purpose');
  });

  it('should detect both Contacts and ContactsUI frameworks', async () => {
    const context = createContextObject(
      '/test/project',
      { CFBundleIdentifier: 'com.example.app' },
      {},
      new Set(['Contacts', 'ContactsUI']),
      []
    );

    const findings = await MissingContactsPurposeRule.evaluate(context);
    
    expect(findings).toHaveLength(1);
    expect(findings[0].description).toContain('Contacts, ContactsUI');
  });
});
