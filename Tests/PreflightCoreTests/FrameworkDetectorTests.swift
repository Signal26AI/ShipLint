import XCTest
@testable import PreflightCore

final class FrameworkDetectorTests: XCTestCase {
    
    // MARK: - Podfile.lock Parsing
    
    func testParsePodfileLock_BasicPods() throws {
        let content = """
        PODS:
          - Alamofire (5.8.0)
          - GoogleSignIn (7.0.0):
            - AppAuth (~> 1.6)
            - GTMSessionFetcher/Core (~> 3.1)
          - FBSDKCoreKit (16.0.0)
        
        DEPENDENCIES:
          - Alamofire
          - GoogleSignIn
          - FBSDKCoreKit
        """
        
        let dependencies = FrameworkDetector.parsePodfileLockContent(content)
        
        XCTAssertEqual(dependencies.count, 3)
        XCTAssertTrue(dependencies.contains { $0.name == "Alamofire" && $0.version == "5.8.0" })
        XCTAssertTrue(dependencies.contains { $0.name == "GoogleSignIn" && $0.version == "7.0.0" })
        XCTAssertTrue(dependencies.contains { $0.name == "FBSDKCoreKit" && $0.version == "16.0.0" })
        XCTAssertTrue(dependencies.allSatisfy { $0.source == .cocoapods })
    }
    
    func testParsePodfileLock_WithSubspecs() throws {
        let content = """
        PODS:
          - Firebase/Analytics (10.0.0):
            - FirebaseAnalytics (~> 10.0)
          - Firebase/Auth (10.0.0):
            - FirebaseAuth (~> 10.0)
          - FirebaseCore (10.0.0)
        
        DEPENDENCIES:
          - Firebase/Analytics
          - Firebase/Auth
        """
        
        let dependencies = FrameworkDetector.parsePodfileLockContent(content)
        
        // Should include both base name and full subspecs
        XCTAssertTrue(dependencies.contains { $0.name == "Firebase" })
        XCTAssertTrue(dependencies.contains { $0.name == "Firebase/Analytics" })
        XCTAssertTrue(dependencies.contains { $0.name == "Firebase/Auth" })
        XCTAssertTrue(dependencies.contains { $0.name == "FirebaseCore" })
    }
    
    func testParsePodfileLock_EmptyFile() throws {
        let content = ""
        let dependencies = FrameworkDetector.parsePodfileLockContent(content)
        XCTAssertTrue(dependencies.isEmpty)
    }
    
    // MARK: - Package.resolved Parsing (Version 2)
    
    func testParsePackageResolved_Version2() throws {
        let json = """
        {
          "pins" : [
            {
              "identity" : "swift-argument-parser",
              "kind" : "remoteSourceControl",
              "location" : "https://github.com/apple/swift-argument-parser.git",
              "state" : {
                "revision" : "8f4d2753",
                "version" : "1.3.0"
              }
            },
            {
              "identity" : "googleanalytics",
              "kind" : "remoteSourceControl",
              "location" : "https://github.com/google/GoogleAnalytics.git",
              "state" : {
                "revision" : "abc123",
                "version" : "8.0.0"
              }
            }
          ],
          "version" : 2
        }
        """
        
        let data = json.data(using: .utf8)!
        let dependencies = try FrameworkDetector.parsePackageResolvedData(data)
        
        XCTAssertEqual(dependencies.count, 2)
        XCTAssertTrue(dependencies.contains { $0.name == "swift-argument-parser" && $0.version == "1.3.0" })
        XCTAssertTrue(dependencies.contains { $0.name == "googleanalytics" && $0.version == "8.0.0" })
        XCTAssertTrue(dependencies.allSatisfy { $0.source == .spm })
    }
    
    // MARK: - Tracking SDK Detection
    
    func testDetectTrackingSDKs_Facebook() throws {
        let dependencies = [
            Dependency(name: "FBSDKCoreKit", version: "16.0.0", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectTrackingSDKs(in: dependencies)
        
        XCTAssertTrue(detected.contains("Facebook SDK"))
    }
    
    func testDetectTrackingSDKs_MultipleSDKs() throws {
        let dependencies = [
            Dependency(name: "Adjust", version: "4.32.0", source: .cocoapods),
            Dependency(name: "AppsFlyer", version: "6.5.0", source: .cocoapods),
            Dependency(name: "FirebaseAnalytics", version: "10.0.0", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectTrackingSDKs(in: dependencies)
        
        XCTAssertEqual(detected.count, 3)
        XCTAssertTrue(detected.contains("Adjust"))
        XCTAssertTrue(detected.contains("AppsFlyer"))
        XCTAssertTrue(detected.contains("Firebase Analytics"))
    }
    
    func testDetectTrackingSDKs_NoTracking() throws {
        let dependencies = [
            Dependency(name: "Alamofire", version: "5.8.0", source: .cocoapods),
            Dependency(name: "SDWebImage", version: "5.18.0", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectTrackingSDKs(in: dependencies)
        
        XCTAssertTrue(detected.isEmpty)
    }
    
    func testHasTrackingSDK() throws {
        let withTracking = [
            Dependency(name: "Mixpanel", version: "4.0.0", source: .cocoapods)
        ]
        let withoutTracking = [
            Dependency(name: "SwiftyJSON", version: "5.0.0", source: .cocoapods)
        ]
        
        XCTAssertTrue(FrameworkDetector.hasTrackingSDK(in: withTracking))
        XCTAssertFalse(FrameworkDetector.hasTrackingSDK(in: withoutTracking))
    }
    
    // MARK: - Social Login SDK Detection
    
    func testDetectSocialLoginSDKs_Google() throws {
        let dependencies = [
            Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectSocialLoginSDKs(in: dependencies)
        
        XCTAssertTrue(detected.contains("Google Sign-In"))
    }
    
    func testDetectSocialLoginSDKs_FacebookLogin() throws {
        let dependencies = [
            Dependency(name: "FBSDKLoginKit", version: "16.0.0", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectSocialLoginSDKs(in: dependencies)
        
        XCTAssertTrue(detected.contains("Facebook Login"))
    }
    
    func testDetectSocialLoginSDKs_Multiple() throws {
        let dependencies = [
            Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods),
            Dependency(name: "FBSDKLoginKit", version: "16.0.0", source: .cocoapods),
            Dependency(name: "TwitterKit", version: "3.4.2", source: .cocoapods)
        ]
        
        let detected = FrameworkDetector.detectSocialLoginSDKs(in: dependencies)
        
        XCTAssertEqual(detected.count, 3)
        XCTAssertTrue(detected.contains("Google Sign-In"))
        XCTAssertTrue(detected.contains("Facebook Login"))
        XCTAssertTrue(detected.contains("Twitter Login"))
    }
    
    func testHasSocialLoginSDK() throws {
        let withSocial = [
            Dependency(name: "GoogleSignIn", version: "7.0.0", source: .cocoapods)
        ]
        let withoutSocial = [
            Dependency(name: "Alamofire", version: "5.8.0", source: .cocoapods)
        ]
        
        XCTAssertTrue(FrameworkDetector.hasSocialLoginSDK(in: withSocial))
        XCTAssertFalse(FrameworkDetector.hasSocialLoginSDK(in: withoutSocial))
    }
    
    // MARK: - Project.pbxproj Parsing
    
    func testParseProjectFrameworks() throws {
        let content = """
        /* Begin PBXFrameworksBuildPhase section */
        12345 /* Frameworks */ = {
            isa = PBXFrameworksBuildPhase;
            files = (
                ABCDE /* AVFoundation.framework in Frameworks */,
                FGHIJ /* CoreLocation.framework in Frameworks */,
                KLMNO /* MapKit.framework in Frameworks */,
            );
        };
        /* End PBXFrameworksBuildPhase section */
        """
        
        let frameworks = FrameworkDetector.parseProjectFrameworksContent(content)
        
        XCTAssertTrue(frameworks.contains("AVFoundation"))
        XCTAssertTrue(frameworks.contains("CoreLocation"))
        XCTAssertTrue(frameworks.contains("MapKit"))
    }
    
    func testParseProjectFrameworks_NoFrameworks() throws {
        let content = """
        /* Empty project */
        rootObject = 12345;
        """
        
        let frameworks = FrameworkDetector.parseProjectFrameworksContent(content)
        
        XCTAssertTrue(frameworks.isEmpty)
    }
    
    // MARK: - SDK Pattern Matching
    
    func testHasSDK_CaseInsensitive() throws {
        let dependencies = [
            Dependency(name: "AMPLITUDE-iOS", version: "8.0.0", source: .cocoapods)
        ]
        
        XCTAssertTrue(FrameworkDetector.hasSDK(matching: "amplitude", in: dependencies))
        XCTAssertTrue(FrameworkDetector.hasSDK(matching: "Amplitude", in: dependencies))
    }
    
    func testHasSDK_PartialMatch() throws {
        let dependencies = [
            Dependency(name: "GoogleSignIn-iOS", version: "7.0.0", source: .cocoapods)
        ]
        
        XCTAssertTrue(FrameworkDetector.hasSDK(matching: "GoogleSignIn", in: dependencies))
    }
}
