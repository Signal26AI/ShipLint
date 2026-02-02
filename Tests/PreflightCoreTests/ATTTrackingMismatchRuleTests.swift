import XCTest
@testable import PreflightCore

final class ATTTrackingMismatchRuleTests: XCTestCase {
    
    var rule: ATTTrackingMismatchRule!
    
    override func setUp() {
        super.setUp()
        rule = ATTTrackingMismatchRule()
    }
    
    override func tearDown() {
        rule = nil
        super.tearDown()
    }
    
    // MARK: - Rule Properties
    
    func testRuleHasCorrectId() {
        XCTAssertEqual(rule.id, "privacy-003-att-tracking-mismatch")
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
    
    // MARK: - No Tracking SDKs
    
    func testNoTrackingSDKs_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "Alamofire", version: "5.8.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when no tracking SDKs present")
    }
    
    // MARK: - Tracking SDK Without ATT
    
    func testFacebookSDK_MissingATT_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FBSDKCoreKit", version: "16.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .critical)
        XCTAssertTrue(findings.first?.description.contains("Facebook SDK") ?? false)
        XCTAssertTrue(findings.first?.description.contains("NSUserTrackingUsageDescription") ?? false)
    }
    
    func testAdjustSDK_MissingATT_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Adjust") ?? false)
    }
    
    func testFirebaseAnalytics_MissingATT_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FirebaseAnalytics", version: "10.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Firebase Analytics") ?? false)
    }
    
    func testMultipleTrackingSDKs_MissingATT_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods),
                Dependency(name: "AppsFlyer", version: "6.5.0", source: .cocoapods),
                Dependency(name: "Mixpanel", version: "4.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Adjust") ?? false)
        XCTAssertTrue(findings.first?.description.contains("AppsFlyer") ?? false)
        XCTAssertTrue(findings.first?.description.contains("Mixpanel") ?? false)
    }
    
    // MARK: - Tracking SDK With ATT
    
    func testTrackingSDK_WithATT_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSUserTrackingUsageDescription": "Allow tracking to show personalized ads."
            ],
            linkedFrameworks: ["UIKit", "AppTrackingTransparency"],
            dependencies: [
                Dependency(name: "FBSDKCoreKit", version: "16.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when ATT is properly implemented")
    }
    
    // MARK: - Empty or Placeholder ATT Description
    
    func testTrackingSDK_EmptyATTDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSUserTrackingUsageDescription": ""
            ],
            linkedFrameworks: ["UIKit", "AppTrackingTransparency"],
            dependencies: [
                Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Empty") ?? false)
    }
    
    func testTrackingSDK_PlaceholderATTDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSUserTrackingUsageDescription": "TODO: add tracking description"
            ],
            linkedFrameworks: ["UIKit", "AppTrackingTransparency"],
            dependencies: [
                Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Placeholder") ?? false)
    }
    
    // MARK: - ATT Description Without Framework
    
    func testTrackingSDK_ATTDescriptionWithoutFramework_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSUserTrackingUsageDescription": "Allow tracking for personalized ads."
            ],
            linkedFrameworks: ["UIKit"],  // No AppTrackingTransparency
            dependencies: [
                Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .medium)  // Lower severity for this case
        XCTAssertTrue(findings.first?.title.contains("AppTrackingTransparency Framework Not Linked") ?? false)
    }
    
    // MARK: - SPM Dependencies
    
    func testTrackingSDK_SPM_MissingATT_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "amplitude-ios", version: "8.0.0", source: .spm)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Amplitude") ?? false)
    }
    
    // MARK: - Finding Properties
    
    func testFindingHasCorrectProperties() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FBSDKCoreKit", version: "16.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        guard let finding = findings.first else {
            XCTFail("Expected a finding")
            return
        }
        
        XCTAssertEqual(finding.ruleId, "privacy-003-att-tracking-mismatch")
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.confidence, .high)
        XCTAssertEqual(finding.guideline, "5.1.2")
        XCTAssertFalse(finding.fixGuidance.isEmpty)
        XCTAssertNotNil(finding.documentationURL)
    }
}
