/**
 * Tests for rules registry
 * Covers bug fix #2: Rule validation
 */
import { 
  allRules, 
  getRule, 
  getRules, 
  getRulesWithValidation,
  getRulesExcluding,
  ruleRegistry 
} from '../../src/rules';

describe('Rules Registry', () => {
  describe('allRules', () => {
    it('should contain all expected rules', () => {
      expect(allRules.length).toBeGreaterThan(0);
      
      // Verify some known rules exist
      const ids = allRules.map(r => r.id);
      expect(ids).toContain('privacy-001-missing-camera-purpose');
      expect(ids).toContain('privacy-002-missing-location-purpose');
    });

    it('should have unique IDs', () => {
      const ids = allRules.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getRule', () => {
    it('should return rule by ID', () => {
      const rule = getRule('privacy-001-missing-camera-purpose');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('privacy-001-missing-camera-purpose');
    });

    it('should return undefined for unknown ID', () => {
      const rule = getRule('nonexistent-rule');
      expect(rule).toBeUndefined();
    });
  });

  describe('getRulesWithValidation', () => {
    it('should return all rules when no IDs specified', () => {
      const result = getRulesWithValidation();
      expect(result.rules).toEqual(allRules);
      expect(result.unknownIds).toEqual([]);
    });

    it('should return all rules for empty array', () => {
      const result = getRulesWithValidation([]);
      expect(result.rules).toEqual(allRules);
      expect(result.unknownIds).toEqual([]);
    });

    it('should return found rules and unknown IDs separately', () => {
      const result = getRulesWithValidation([
        'privacy-001-missing-camera-purpose',
        'typo-rule',
        'privacy-002-missing-location-purpose',
        'another-bad-rule'
      ]);

      expect(result.rules.length).toBe(2);
      expect(result.rules.map(r => r.id)).toContain('privacy-001-missing-camera-purpose');
      expect(result.rules.map(r => r.id)).toContain('privacy-002-missing-location-purpose');
      
      expect(result.unknownIds).toContain('typo-rule');
      expect(result.unknownIds).toContain('another-bad-rule');
      expect(result.unknownIds.length).toBe(2);
    });

    it('should return all unknown when all IDs are invalid', () => {
      const result = getRulesWithValidation(['bad1', 'bad2', 'bad3']);

      expect(result.rules).toEqual([]);
      expect(result.unknownIds).toEqual(['bad1', 'bad2', 'bad3']);
    });
  });

  describe('getRules (deprecated)', () => {
    it('should still work for backwards compatibility', () => {
      const rules = getRules(['privacy-001-missing-camera-purpose']);
      expect(rules.length).toBe(1);
      expect(rules[0].id).toBe('privacy-001-missing-camera-purpose');
    });

    it('should silently drop unknown IDs (deprecated behavior)', () => {
      // This is the old behavior we're deprecating but keeping for compatibility
      const rules = getRules(['privacy-001-missing-camera-purpose', 'bad-rule']);
      expect(rules.length).toBe(1);
    });
  });

  describe('getRulesExcluding', () => {
    it('should exclude specified rules', () => {
      const rules = getRulesExcluding(['privacy-001-missing-camera-purpose']);
      
      expect(rules.length).toBe(allRules.length - 1);
      expect(rules.map(r => r.id)).not.toContain('privacy-001-missing-camera-purpose');
    });

    it('should return all rules for empty exclude list', () => {
      const rules = getRulesExcluding([]);
      expect(rules).toEqual(allRules);
    });

    it('should ignore unknown IDs in exclude list', () => {
      const rules = getRulesExcluding(['nonexistent-rule']);
      expect(rules).toEqual(allRules);
    });
  });
});
