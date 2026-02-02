import XCTest
@testable import PreflightCore

final class ThirdPartyLoginNoSIWARuleTests: XCTestCase {
    
    var rule: ThirdPartyLoginNoSIWARule!
    
    override func setUp() {
        super.setUp()
        rule = ThirdPartyLoginNoSIWARule()
    }
    
    override func tearDown() {
        rule = nil
        super.tearDown()
    }
    
    // MARK: - Rule Properties
    
    func testRuleHasCorrectId() {
        XCTAssertEqual(rule.id, "auth-001-third-party-login-no-siwa")
    }
    
    func testRuleHasCorrectSeverity() {
        XCTAssertEqual(rule.severity, .critical)
    }
    
    func testRuleHasCorrectCategory() {
        XCTAssertEqual(rule.category, .auth)
    }
    
    func testRuleHasCorrectConfidence() {
        XCTAssertEqual(rule.confidence, .high)
    }
    
    // MARK: - No Social Login SDKs
    
    func testNoSocialLoginSDKs_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "Alamofire", version: "5.8.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when no social login SDKs present")
    }
    
    // MARK: - Google Sign-In Without SIWA
    
    func testGoogleSignIn_NoSIWA_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .critical)
        XCTAssertTrue(findings.first?.description.contains("Google Sign-In") ?? false)
        XCTAssertTrue(findings.first?.description.contains("Sign in with Apple") ?? false)
    }
    
    // MARK: - Facebook Login Without SIWA
    
    func testFacebookLogin_NoSIWA_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FBSDKLoginKit", version: "16.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Facebook Login") ?? false)
    }
    
    // MARK: - Multiple Social Logins Without SIWA
    
    func testMultipleSocialLogins_NoSIWA_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods),
                Dependency(name: "FBSDKLoginKit", version: "16.0.0", source: .cocoapods),
                Dependency(name: "TwitterKit", version: "3.4.2", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertTrue(findings.first?.description.contains("Google Sign-In") ?? false)
        XCTAssertTrue(findings.first?.description.contains("Facebook Login") ?? false)
        XCTAssertTrue(findings.first?.description.contains("Twitter Login") ?? false)
    }
    
    // MARK: - Social Login With SIWA
    
    func testGoogleSignIn_WithSIWA_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [
                "com.apple.developer.applesignin": ["Default"]
            ],
            linkedFrameworks: ["UIKit", "AuthenticationServices"],
            dependencies: [
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "Should not flag when SIWA is properly implemented")
    }
    
    // MARK: - SIWA Capability Without Framework
    
    func testSocialLogin_SIWACapabilityButNoFramework_ReturnsFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [
                "com.apple.developer.applesignin": ["Default"]
            ],
            linkedFrameworks: ["UIKit"],  // No AuthenticationServices
            dependencies: [
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.severity, .medium)  // Lower severity
        XCTAssertTrue(findings.first?.title.contains("May Not Be Implemented") ?? false)
    }
    
    // MARK: - Ambiguous SDKs (Firebase Auth, Auth0)
    
    func testFirebaseAuthOnly_NoSIWA_ReturnsMediumConfidenceFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FirebaseAuth", version: "10.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        // Firebase Auth alone should produce a medium-confidence finding
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.confidence, .medium)
        XCTAssertEqual(findings.first?.severity, .medium)
        XCTAssertTrue(findings.first?.title.contains("Potential") ?? false)
    }
    
    func testAuth0Only_NoSIWA_ReturnsMediumConfidenceFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "Auth0", version: "2.5.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.confidence, .medium)
    }
    
    func testFirebaseAuthWithGoogle_NoSIWA_ReturnsHighConfidenceFinding() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "FirebaseAuth", version: "10.0.0", source: .cocoapods),
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        // With Google Sign-In, this should be high confidence
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings.first?.confidence, .high)
        XCTAssertEqual(findings.first?.severity, .critical)
    }
    
    // MARK: - SIWA Only
    
    func testSIWAOnly_ReturnsNoFindings() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [
                "com.apple.developer.applesignin": ["Default"]
            ],
            linkedFrameworks: ["UIKit", "AuthenticationServices"],
            dependencies: []
        )
        
        let findings = try await rule.evaluate(context: context)
        
        XCTAssertTrue(findings.isEmpty, "SIWA-only apps should pass")
    }
    
    // MARK: - Finding Properties
    
    func testFindingHasCorrectProperties() async throws {
        let context = ScanContext(
            projectPath: URL(fileURLWithPath: "/test/project"),
            infoPlist: [:],
            entitlements: [:],
            linkedFrameworks: ["UIKit"],
            dependencies: [
                Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
            ]
        )
        
        let findings = try await rule.evaluate(context: context)
        
        guard let finding = findings.first else {
            XCTFail("Expected a finding")
            return
        }
        
        XCTAssertEqual(finding.ruleId, "auth-001-third-party-login-no-siwa")
        XCTAssertEqual(finding.severity, .critical)
        XCTAssertEqual(finding.confidence, .high)
        XCTAssertEqual(finding.guideline, "4.8")
        XCTAssertEqual(finding.location, "Entitlements")
        XCTAssertFalse(finding.fixGuidance.isEmpty)
        XCTAssertNotNil(finding.documentationURL)
    }
}
