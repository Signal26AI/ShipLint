import XCTest
@testable import PreflightCore

final class EntitlementsParserTests: XCTestCase {
    
    // MARK: - Parse Data Tests
    
    func testParseValidEntitlements() throws {
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>com.apple.developer.applesignin</key>
            <array>
                <string>Default</string>
            </array>
            <key>aps-environment</key>
            <string>development</string>
        </dict>
        </plist>
        """
        
        let data = plist.data(using: .utf8)!
        let result = try EntitlementsParser.parse(data: data)
        
        XCTAssertEqual(result.count, 2)
        XCTAssertNotNil(result["com.apple.developer.applesignin"])
        XCTAssertNotNil(result["aps-environment"])
    }
    
    func testParseEmptyEntitlements() throws {
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <plist version="1.0">
        <dict>
        </dict>
        </plist>
        """
        
        let data = plist.data(using: .utf8)!
        let result = try EntitlementsParser.parse(data: data)
        
        XCTAssertTrue(result.isEmpty)
    }
    
    func testParseInvalidData() {
        let data = "not a plist".data(using: .utf8)!
        
        XCTAssertThrowsError(try EntitlementsParser.parse(data: data)) { error in
            XCTAssertTrue(error is EntitlementsParser.ParseError)
        }
    }
    
    // MARK: - Sign in with Apple Detection
    
    func testHasSignInWithApple_Present() throws {
        let entitlements: [String: Any] = [
            "com.apple.developer.applesignin": ["Default"]
        ]
        
        XCTAssertTrue(EntitlementsParser.hasSignInWithApple(entitlements))
    }
    
    func testHasSignInWithApple_Missing() throws {
        let entitlements: [String: Any] = [
            "aps-environment": "development"
        ]
        
        XCTAssertFalse(EntitlementsParser.hasSignInWithApple(entitlements))
    }
    
    func testHasSignInWithApple_EmptyArray() throws {
        let entitlements: [String: Any] = [
            "com.apple.developer.applesignin": [] as [String]
        ]
        
        // Empty array means SIWA is configured but not with Default
        XCTAssertTrue(EntitlementsParser.hasSignInWithApple(entitlements))
    }
    
    // MARK: - HealthKit Detection
    
    func testHasHealthKit_Present() throws {
        let entitlements: [String: Any] = [
            "com.apple.developer.healthkit": true
        ]
        
        XCTAssertTrue(EntitlementsParser.hasHealthKit(entitlements))
    }
    
    func testHasHealthKit_Missing() throws {
        let entitlements: [String: Any] = [:]
        
        XCTAssertFalse(EntitlementsParser.hasHealthKit(entitlements))
    }
    
    // MARK: - Structured Parsing
    
    func testParsedEntitlements_AllCapabilities() throws {
        let plist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <plist version="1.0">
        <dict>
            <key>com.apple.developer.applesignin</key>
            <array>
                <string>Default</string>
            </array>
            <key>com.apple.developer.healthkit</key>
            <true/>
            <key>aps-environment</key>
            <string>production</string>
            <key>com.apple.security.application-groups</key>
            <array>
                <string>group.com.example.app</string>
            </array>
        </dict>
        </plist>
        """
        
        let data = plist.data(using: .utf8)!
        let dict = try EntitlementsParser.parse(data: data)
        let parsed = EntitlementsParser.ParsedEntitlements(from: dict)
        
        XCTAssertTrue(parsed.hasSignInWithApple)
        XCTAssertTrue(parsed.hasHealthKit)
        XCTAssertTrue(parsed.hasPushNotifications)
        XCTAssertTrue(parsed.hasAppGroups)
        XCTAssertEqual(parsed.appGroups, ["group.com.example.app"])
    }
    
    // MARK: - Helper Methods
    
    func testHasEntitlement() throws {
        let entitlements: [String: Any] = [
            "aps-environment": "production"
        ]
        
        XCTAssertTrue(EntitlementsParser.hasEntitlement("aps-environment", in: entitlements))
        XCTAssertFalse(EntitlementsParser.hasEntitlement("nonexistent", in: entitlements))
    }
    
    func testArrayValue() throws {
        let entitlements: [String: Any] = [
            "com.apple.security.application-groups": ["group.one", "group.two"]
        ]
        
        let result = EntitlementsParser.arrayValue(for: "com.apple.security.application-groups", in: entitlements)
        XCTAssertEqual(result, ["group.one", "group.two"])
        XCTAssertNil(EntitlementsParser.arrayValue(for: "nonexistent", in: entitlements))
    }
    
    func testStringValue() throws {
        let entitlements: [String: Any] = [
            "aps-environment": "development"
        ]
        
        XCTAssertEqual(EntitlementsParser.stringValue(for: "aps-environment", in: entitlements), "development")
        XCTAssertNil(EntitlementsParser.stringValue(for: "nonexistent", in: entitlements))
    }
}
