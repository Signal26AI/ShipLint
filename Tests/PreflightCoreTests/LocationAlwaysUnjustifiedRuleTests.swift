import XCTest
@testable import PreflightCore

final class LocationAlwaysUnjustifiedRuleTests: XCTestCase {
    
    var rule: LocationAlwaysUnjustifiedRule!
    
    override func setUp() {
        super.setUp()
        rule = LocationAlwaysUnjustifiedRule()
    }
    
    override func tearDown() {
        rule = nil
        super.tearDown()
    }
    
    // MARK: - Rule Properties
    
    func testRuleHasCorrectId() {
        XCTAssertEqual(rule.id, "entitlements-001-location-always-unjustified")
    }
    
    func testRuleHasCorrectSeverity() {
        XCTAssertEqual(rule.severity, .critical)
    }
    
    func testRuleHasCorrectCategory() {
        XCTAssertEqual(rule.category, .privacy)
    }
    
    func testRuleHasCorrectConfidence() {
        XCTAssertEqual(rule.confidence, .medium)  // Heuristic-based
    }
    
    // MARK: - No Always Permission
    
    func testNoAlwaysPermission_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when only WhenInUse permission is used")
    }
    
    // MARK: - Always Permission Without Background Mode
    
    func testAlwaysPermission_NoBackgroundMode_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your location."
                // Missing UIBackgroundModes with "location"
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .critical)
        XCTAssertTrue(findings.first?.description.contains("UIBackgroundModes") ?? false)
        XCTAssertTrue(findings.first?.description.contains("location") ?? false)
    }
    
    func testLegacyAlwaysKey_NoBackgroundMode_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysUsageDescription": "Track your location."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    func testBothAlwaysKeys_NoBackgroundMode_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysUsageDescription": "Track location.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your runs."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    // MARK: - Always Permission With Background Mode
    
    func testAlwaysPermission_WithBackgroundMode_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your runs in the background.",
                "UIBackgroundModes": ["location"]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when background mode is properly configured")
    }
    
    func testAlwaysPermission_WithMultipleBackgroundModes_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your runs in the background.",
                "UIBackgroundModes": ["audio", "location", "fetch"]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty)
    }
    
    // MARK: - Background Mode Without Location
    
    func testAlwaysPermission_WrongBackgroundMode_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track location.",
                "UIBackgroundModes": ["audio", "fetch"]  // No "location"
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    func testAlwaysPermission_EmptyBackgroundModes_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track location.",
                "UIBackgroundModes": [] as [String]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    // MARK: - Vague Description Detection
    
    func testAlwaysPermission_VagueDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "We need your location.",  // Vague
                "UIBackgroundModes": ["location"]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .medium)  // Lower severity for vague description
        XCTAssertEqual(findings.first?.confidence, .low)
        XCTAssertTrue(findings.first?.title.contains("Insufficient") ?? false)
    }
    
    func testAlwaysPermission_GoodDescription_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your runs in the background so you can see your complete route.",
                "UIBackgroundModes": ["location"]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty)
    }
    
    func testAlwaysPermission_NavigationDescription_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Provide turn-by-turn navigation even when the screen is off.",
                "UIBackgroundModes": ["location"]
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty)
    }
    
    // MARK: - Finding Properties
    
    func testFindingHasCorrectProperties() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track location."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        guard let finding = findings.first else {
            XCTFail("Expected a finding")
            return
        }
        
        XCTAssertEqual(finding.ruleId, "entitlements-001-location-always-unjustified")
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.confidence, .medium)
        XCTAssertEqual(finding.guideline, "5.1.1")
        XCTAssertEqual(finding.location, "Info.plist")
        XCTAssertFalse(finding.fixGuidance.isEmpty)
        XCTAssertNotNil(finding.documentationURL)
    }
}
