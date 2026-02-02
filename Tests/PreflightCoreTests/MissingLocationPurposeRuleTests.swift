import XCTest
@testable import PreflightCore

final class MissingLocationPurposeRuleTests: XCTestCase {
    
    var rule: MissingLocationPurposeRule!
    
    override func setUp() {
        super.setUp()
        rule = MissingLocationPurposeRule()
    }
    
    override func tearDown() {
        rule = nil
        super.tearDown()
    }
    
    // MARK: - Rule Properties
    
    func testRuleHasCorrectId() {
        XCTAssertEqual(rule.id, "privacy-002-missing-location-purpose")
    }
    
    func testRuleHasCorrectSeverity() {
        XCTAssertEqual(rule.severity, .critical)
    }
    
    func testRuleHasCorrectCategory() {
        XCTAssertEqual(rule.category, .privacy)
    }
    
    func testRuleHasCorrectConfidence() {
        XCTAssertEqual(rule.confidence, .high)
    }
    
    // MARK: - No Location Framework
    
    func testNoLocationFramework_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit", "Foundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when no location framework is linked")
    }
    
    // MARK: - Missing WhenInUse Description
    
    func testCoreLocation_MissingDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "CFBundleIdentifier": "com.test.app"
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.ruleId, rule.id)
        XCTAssertEqual(findings.first?.severity, .critical)
        XCTAssertTrue(findings.first?.description.contains("missing NSLocationWhenInUseUsageDescription") ?? false)
    }
    
    func testMapKit_MissingDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["MapKit"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    // MARK: - Valid WhenInUse Description
    
    func testValidWhenInUseDescription_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby coffee shops and restaurants."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when valid location description exists")
    }
    
    // MARK: - Empty WhenInUse Description
    
    func testEmptyWhenInUseDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": ""
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Empty") ?? false)
    }
    
    func testWhitespaceOnlyWhenInUseDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "   \n\t  "
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Empty") ?? false)
    }
    
    // MARK: - Placeholder Detection
    
    func testPlaceholderTODO_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "TODO: Add location description"
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Placeholder") ?? false)
    }
    
    // MARK: - Always Permission
    
    func testAlwaysPermission_MissingAlwaysAndWhenInUse_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysUsageDescription": "Track your location for alerts."
                // Missing NSLocationAlwaysAndWhenInUseUsageDescription
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Always And When In Use") ?? false)
    }
    
    func testAlwaysPermission_ValidBothDescriptions_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places while using the app.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "Track your runs in the background."
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty)
    }
    
    func testAlwaysPermission_EmptyAlwaysDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": ""
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Empty Always") ?? false)
    }
    
    func testAlwaysPermission_PlaceholderAlwaysDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSLocationWhenInUseUsageDescription": "Find nearby places.",
                "NSLocationAlwaysAndWhenInUseUsageDescription": "TODO: add always description"
            ],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Placeholder Always") ?? false)
    }
    
    // MARK: - Finding Properties
    
    func testFindingHasCorrectProperties() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["CoreLocation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        guard let finding = findings.first else {
            XCTFail("Expected a finding")
            return
        }
        
        XCTAssertEqual(finding.ruleId, "privacy-002-missing-location-purpose")
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.confidence, .high)
        XCTAssertEqual(finding.guideline, "5.1.1")
        XCTAssertEqual(finding.location, "Info.plist")
        XCTAssertFalse(finding.fixGuidance.isEmpty)
        XCTAssertNotNil(finding.documentationURL)
    }
}
