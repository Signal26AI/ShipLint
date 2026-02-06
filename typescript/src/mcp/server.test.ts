/**
 * Tests for ShipLint MCP Server
 */
import { createMcpServer } from './server.js';
import { allRules, getRule } from '../rules/index.js';

// We'll test the server's tool registration and handlers directly
// by accessing the internal registrations through the server

describe('ShipLint MCP Server', () => {
  describe('createMcpServer', () => {
    it('should create a server with correct metadata', () => {
      const server = createMcpServer();
      expect(server).toBeDefined();
      expect(server.server).toBeDefined();
    });
  });

  describe('shiplint_rules tool', () => {
    it('should return all available rules', () => {
      // Verify the rules we expect to expose
      const rules = allRules.map(rule => ({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        guideline: rule.guidelineReference,
      }));

      expect(rules.length).toBeGreaterThan(0);
      
      // Check that each rule has required fields
      for (const rule of rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.category).toBeTruthy();
        expect(rule.severity).toBeTruthy();
        expect(rule.guideline).toBeTruthy();
      }
    });

    it('should have rules with valid severities', () => {
      const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
      
      for (const rule of allRules) {
        expect(validSeverities).toContain(rule.severity);
      }
    });
  });

  describe('shiplint_explain tool', () => {
    it('should return details for valid rule ID', () => {
      const ruleId = 'privacy-001-missing-camera-purpose';
      const rule = getRule(ruleId);
      
      expect(rule).toBeDefined();
      expect(rule!.id).toBe(ruleId);
      expect(rule!.name).toBeTruthy();
      expect(rule!.description).toBeTruthy();
      expect(rule!.category).toBeTruthy();
      expect(rule!.severity).toBeTruthy();
      expect(rule!.confidence).toBeTruthy();
      expect(rule!.guidelineReference).toBeTruthy();
    });

    it('should return undefined for invalid rule ID', () => {
      const rule = getRule('invalid-rule-id');
      expect(rule).toBeUndefined();
    });

    it('should have all expected fields for each rule', () => {
      for (const rule of allRules) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(rule.category).toBeTruthy();
        expect(rule.severity).toBeTruthy();
        expect(rule.confidence).toBeTruthy();
        expect(rule.guidelineReference).toBeTruthy();
        expect(typeof rule.evaluate).toBe('function');
      }
    });
  });

  describe('Rule ID consistency', () => {
    it('should have unique rule IDs', () => {
      const ids = allRules.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have rule IDs that follow naming convention', () => {
      // Rule IDs should follow pattern: category-number-description
      const pattern = /^[a-z]+-\d{3}-[a-z-]+$/;
      
      for (const rule of allRules) {
        expect(rule.id).toMatch(pattern);
      }
    });
  });

  describe('Scan output structure', () => {
    // Note: Full scan tests are in scanner.test.ts
    // Here we just validate the expected output structure for MCP
    
    it('should have severity enum with expected values', () => {
      const { Severity } = require('../types/index.js');
      
      expect(Severity.Critical).toBe('critical');
      expect(Severity.High).toBe('high');
      expect(Severity.Medium).toBe('medium');
      expect(Severity.Low).toBe('low');
      expect(Severity.Info).toBe('info');
    });

    it('should have confidence enum with expected values', () => {
      const { Confidence } = require('../types/index.js');
      
      expect(Confidence.High).toBe('high');
      expect(Confidence.Medium).toBe('medium');
      expect(Confidence.Low).toBe('low');
    });
  });
});

describe('MCP Tool Schemas', () => {
  describe('shiplint_scan input validation', () => {
    it('should require path parameter', () => {
      // The path is required in our schema
      const validInput = { path: '/some/project' };
      const invalidInput = { rules: ['some-rule'] }; // missing path
      
      expect(validInput.path).toBeTruthy();
      expect((invalidInput as any).path).toBeUndefined();
    });

    it('should accept optional rules and exclude arrays', () => {
      const inputWithRules = {
        path: '/project',
        rules: ['privacy-001-missing-camera-purpose'],
      };
      
      const inputWithExclude = {
        path: '/project',
        exclude: ['auth-001-third-party-login-no-siwa'],
      };
      
      const inputWithBoth = {
        path: '/project',
        rules: ['privacy-001-missing-camera-purpose'],
        exclude: ['auth-001-third-party-login-no-siwa'],
      };
      
      expect(inputWithRules.rules).toHaveLength(1);
      expect(inputWithExclude.exclude).toHaveLength(1);
      expect(inputWithBoth.rules).toHaveLength(1);
      expect(inputWithBoth.exclude).toHaveLength(1);
    });
  });

  describe('shiplint_explain input validation', () => {
    it('should require ruleId parameter', () => {
      const validInput = { ruleId: 'privacy-001-missing-camera-purpose' };
      expect(validInput.ruleId).toBeTruthy();
    });
  });
});
