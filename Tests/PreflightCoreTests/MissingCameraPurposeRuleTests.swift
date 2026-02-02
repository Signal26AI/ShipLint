import XCTest
@testable import PreflightCore

final class MissingCameraPurposeRuleTests: XCTestCase {
    
    var rule: MissingCameraPurposeRule!
    
    override func setUp() {
        super.setUp()
        rule = MissingCameraPurposeRule()
    }
    
    override func tearDown() {
        rule = nil
        super.tearDown()
    }
    
    // MARK: - Rule Properties
    
    func testRuleHasCorrectId() {
        XCTAssertEqual(rule.id, "privacy-001-missing-camera-purpose")
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
    
    // MARK: - No Camera Framework
    
    func testNoCameraFramework_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],  // No camera description
            linkedFrameworks: ["UIKit", "Foundation"]  // No camera framework
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when no camera framework is linked")
    }
    
    // MARK: - Missing Camera Description
    
    func testAVFoundation_MissingDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "CFBundleIdentifier": "com.test.app"
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.ruleId, rule.id)
        XCTAssertEqual(findings.first?.severity, .critical)
        XCTAssertTrue(findings.first?.description.contains("missing NSCameraUsageDescription") ?? false)
    }
    
    func testAVKit_MissingDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["AVKit"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .critical)
    }
    
    func testVisionKit_MissingDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["VisionKit"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    // MARK: - Valid Camera Description
    
    func testValidCameraDescription_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSCameraUsageDescription": "We need camera access to take photos for your profile."
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when valid camera description exists")
    }
    
    // MARK: - Empty Camera Description
    
    func testEmptyCameraDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSCameraUsageDescription": ""
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Empty") ?? false)
    }
    
    func testWhitespaceOnlyCameraDescription_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSCameraUsageDescription": "   \n\t  "
            ],
            linkedFrameworks: ["AVFoundation"]
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
                "NSCameraUsageDescription": "TODO: Add camera description"
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Placeholder") ?? false)
    }
    
    func testPlaceholderLoremIpsum_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSCameraUsageDescription": "Lorem ipsum dolor sit amet"
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.title.contains("Placeholder") ?? false)
    }
    
    func testPlaceholderTest_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [
                "NSCameraUsageDescription": "test testing"
            ],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
    }
    
    // MARK: - Multiple Frameworks
    
    func testMultipleCameraFrameworks_ReturnsSingleFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["AVFoundation", "AVKit", "VisionKit"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        // Should return single finding even with multiple camera frameworks
        XCTAssertEqual(findings.count, 1)
        // Description should mention the frameworks
        XCTAssertTrue(findings.first?.description.contains("AVFoundation") ?? false)
    }
    
    // MARK: - Finding Properties
    
    func testFindingHasCorrectProperties() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            linkedFrameworks: ["AVFoundation"]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        guard let finding = findings.first else {
            XCTFail("Expected a finding")
            return
        }
        
        XCTAssertEqual(finding.ruleId, "privacy-001-missing-camera-purpose")
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.confidence, .high)
        XCTAssertEqual(finding.guideline, "5.1.1")
        XCTAssertEqual(finding.location, "Info.plist")
        XCTAssertFalse(finding.fixGuidance.isEmpty)
        XCTAssertNotNil(finding.documentationURL)
    }
}
