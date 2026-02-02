import XCTest
@testable import PreflightCore

final class RuleRegistryTests: XCTestCase {
    
    var registry: RuleRegistry!
    
    override func setUp() {
        super.setUp()
        registry = RuleRegistry()
    }
    
    override func tearDown() {
        registry = nil
        super.tearDown()
    }
    
    // MARK: - Registration
    
    func testRegisterRule() {
        let rule = MissingCameraPurposeRule()
        registry.register(rule)
        
        XCTAssertEqual(registry.count, 1)
        XCTAssertNotNil(registry.rule(withId: rule.id))
    }
    
    func testRegisterMultipleRules() {
        let rule1 = MissingCameraPurposeRule()
        let rule2 = MockRule(id: "mock-001", category: .auth)
        
        registry.register(rule1)
        registry.register(rule2)
        
        XCTAssertEqual(registry.count, 2)
    }
    
    func testRegisterDuplicateReplacesExisting() {
        let rule1 = MockRule(id: "test-001", category: .privacy)
        let rule2 = MockRule(id: "test-001", category: .auth) // Same ID, different category
        
        registry.register(rule1)
        registry.register(rule2)
        
        XCTAssertEqual(registry.count, 1)
        let found = registry.rule(withId: "test-001")
        XCTAssertEqual(found?.category, .auth) // Should have the second rule's category
    }
    
    // MARK: - Retrieval
    
    func testAllRules() {
        let rule1 = MissingCameraPurposeRule()
        let rule2 = MockRule(id: "mock-001", category: .auth)
        
        registry.register([rule1, rule2])
        
        let allRules = registry.allRules()
        XCTAssertEqual(allRules.count, 2)
    }
    
    func testRuleWithId() {
        let rule = MissingCameraPurposeRule()
        registry.register(rule)
        
        let found = registry.rule(withId: rule.id)
        XCTAssertNotNil(found)
        XCTAssertEqual(found?.id, rule.id)
        
        let notFound = registry.rule(withId: "nonexistent")
        XCTAssertNil(notFound)
    }
    
    func testRulesForCategory() {
        let privacyRule = MissingCameraPurposeRule() // .privacy
        let authRule = MockRule(id: "auth-001", category: .auth)
        let anotherPrivacy = MockRule(id: "privacy-002", category: .privacy)
        
        registry.register([privacyRule, authRule, anotherPrivacy])
        
        let privacyRules = registry.rules(for: .privacy)
        XCTAssertEqual(privacyRules.count, 2)
        
        let authRules = registry.rules(for: .auth)
        XCTAssertEqual(authRules.count, 1)
        
        let iapRules = registry.rules(for: .iap)
        XCTAssertEqual(iapRules.count, 0)
    }
    
    func testRulesMinSeverity() {
        let criticalRule = MockRule(id: "critical-001", category: .privacy, severity: .critical)
        let highRule = MockRule(id: "high-001", category: .privacy, severity: .high)
        let lowRule = MockRule(id: "low-001", category: .privacy, severity: .low)
        
        registry.register([criticalRule, highRule, lowRule])
        
        let criticalAndAbove = registry.rules(minSeverity: .critical)
        XCTAssertEqual(criticalAndAbove.count, 1)
        
        let highAndAbove = registry.rules(minSeverity: .high)
        XCTAssertEqual(highAndAbove.count, 2)
        
        let lowAndAbove = registry.rules(minSeverity: .low)
        XCTAssertEqual(lowAndAbove.count, 3)
    }
    
    // MARK: - Enable/Disable
    
    func testDisableRule() {
        let rule = MissingCameraPurposeRule()
        registry.register(rule)
        
        XCTAssertTrue(registry.isEnabled(rule.id))
        
        registry.disable(rule.id)
        
        XCTAssertFalse(registry.isEnabled(rule.id))
        XCTAssertEqual(registry.enabledRules().count, 0)
        XCTAssertEqual(registry.allRules().count, 1) // Still in registry
    }
    
    func testEnableRule() {
        let rule = MissingCameraPurposeRule()
        registry.register(rule)
        registry.disable(rule.id)
        
        XCTAssertFalse(registry.isEnabled(rule.id))
        
        registry.enable(rule.id)
        
        XCTAssertTrue(registry.isEnabled(rule.id))
        XCTAssertEqual(registry.enabledRules().count, 1)
    }
    
    // MARK: - Default Registry
    
    func testDefaultRegistry() {
        let defaultRegistry = RuleRegistry.default
        
        // Should have all 5 MVP rules
        XCTAssertEqual(defaultRegistry.count, 5)
        
        // Privacy rules
        XCTAssertNotNil(defaultRegistry.rule(withId: "privacy-001-missing-camera-purpose"))
        XCTAssertNotNil(defaultRegistry.rule(withId: "privacy-002-missing-location-purpose"))
        XCTAssertNotNil(defaultRegistry.rule(withId: "privacy-003-att-tracking-mismatch"))
        XCTAssertNotNil(defaultRegistry.rule(withId: "entitlements-001-location-always-unjustified"))
        
        // Auth rules
        XCTAssertNotNil(defaultRegistry.rule(withId: "auth-001-third-party-login-no-siwa"))
    }
    
    func testDefaultRegistryRuleCategories() {
        let defaultRegistry = RuleRegistry.default
        
        // 4 privacy rules (camera, location, ATT, location always)
        let privacyRules = defaultRegistry.rules(for: .privacy)
        XCTAssertEqual(privacyRules.count, 4)
        
        // 1 auth rule (SIWA)
        let authRules = defaultRegistry.rules(for: .auth)
        XCTAssertEqual(authRules.count, 1)
    }
    
    func testDefaultRegistryRuleSeverities() {
        let defaultRegistry = RuleRegistry.default
        
        // All MVP rules should be critical
        let criticalRules = defaultRegistry.rules(minSeverity: .critical)
        XCTAssertEqual(criticalRules.count, 5)
    }
}

// MARK: - Mock Rule for Testing

struct MockRule: Rule {
    let id: String
    let name: String
    let category: RuleCategory
    let severity: Severity
    let confidence: Confidence
    let guidelineReference: String
    
    init(
        id: String,
        category: RuleCategory,
        severity: Severity = .medium,
        name: String = "Mock Rule",
        confidence: Confidence = .high,
        guidelineReference: String = "0.0"
    ) {
        self.id = id
        self.name = name
        self.category = category
        self.severity = severity
        self.confidence = confidence
        self.guidelineReference = guidelineReference
    }
    
    func evaluate(context: ScanContext) async throws -> [Finding] {
        return []
    }
}
