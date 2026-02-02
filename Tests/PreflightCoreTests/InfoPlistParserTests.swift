import XCTest
@testable import PreflightCore

final class InfoPlistParserTests: XCTestCase {
    
    // MARK: - Parsing
    
    func testParseValidPlist() throws {
        let plistContent = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>CFBundleIdentifier</key>
            <string>com.example.app</string>
            <key>CFBundleName</key>
            <string>TestApp</string>
        </dict>
        </plist>
        """
        
        let data = plistContent.data(using: .utf8)!
        let dict = try InfoPlistParser.parse(data: data)
        
        XCTAssertEqual(dict["CFBundleIdentifier"] as? String, "com.example.app")
        XCTAssertEqual(dict["CFBundleName"] as? String, "TestApp")
    }
    
    func testParseStructured() throws {
        let plistContent = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <dict>
            <key>CFBundleIdentifier</key>
            <string>com.example.structured</string>
            <key>CFBundleDisplayName</key>
            <string>Structured App</string>
            <key>MinimumOSVersion</key>
            <string>15.0</string>
            <key>NSCameraUsageDescription</key>
            <string>For photos</string>
            <key>NSLocationWhenInUseUsageDescription</key>
            <string>For maps</string>
            <key>UIBackgroundModes</key>
            <array>
                <string>audio</string>
                <string>fetch</string>
            </array>
        </dict>
        </plist>
        """
        
        let data = plistContent.data(using: .utf8)!
        let dict = try InfoPlistParser.parse(data: data)
        let parsed = InfoPlistParser.ParsedInfoPlist(from: dict)
        
        XCTAssertEqual(parsed.bundleIdentifier, "com.example.structured")
        XCTAssertEqual(parsed.displayName, "Structured App")
        XCTAssertEqual(parsed.minimumOSVersion, "15.0")
        XCTAssertEqual(parsed.usageDescriptions.count, 2)
        XCTAssertEqual(parsed.usageDescriptions["NSCameraUsageDescription"], "For photos")
        XCTAssertEqual(parsed.backgroundModes, ["audio", "fetch"])
    }
    
    // MARK: - Usage Description Extraction
    
    func testExtractUsageDescriptions() {
        let dict: [String: Any] = [
            "CFBundleIdentifier": "com.test.app",
            "NSCameraUsageDescription": "Camera access",
            "NSLocationWhenInUseUsageDescription": "Location access",
            "NSPhotoLibraryUsageDescription": "Photo access",
            "SomeOtherKey": "Some value"
        ]
        
        let descriptions = InfoPlistParser.extractUsageDescriptions(from: dict)
        
        XCTAssertEqual(descriptions.count, 3)
        XCTAssertEqual(descriptions["NSCameraUsageDescription"], "Camera access")
        XCTAssertEqual(descriptions["NSLocationWhenInUseUsageDescription"], "Location access")
        XCTAssertEqual(descriptions["NSPhotoLibraryUsageDescription"], "Photo access")
        XCTAssertNil(descriptions["SomeOtherKey"])
    }
    
    // MARK: - Placeholder Detection
    
    func testIsPlaceholder_EmptyString() {
        XCTAssertTrue(InfoPlistParser.isPlaceholder(""))
        XCTAssertTrue(InfoPlistParser.isPlaceholder("   "))
    }
    
    func testIsPlaceholder_ShortString() {
        XCTAssertTrue(InfoPlistParser.isPlaceholder("Camera"))
        XCTAssertTrue(InfoPlistParser.isPlaceholder("Test"))
    }
    
    func testIsPlaceholder_LoremIpsum() {
        XCTAssertTrue(InfoPlistParser.isPlaceholder("Lorem ipsum dolor sit amet"))
        XCTAssertTrue(InfoPlistParser.isPlaceholder("lorem ipsum is a placeholder"))
    }
    
    func testIsPlaceholder_TODO() {
        XCTAssertTrue(InfoPlistParser.isPlaceholder("TODO: Add description"))
        XCTAssertTrue(InfoPlistParser.isPlaceholder("FIXME: Update this"))
    }
    
    func testIsPlaceholder_ValidDescription() {
        XCTAssertFalse(InfoPlistParser.isPlaceholder("We need access to your camera to take photos for your profile."))
        XCTAssertFalse(InfoPlistParser.isPlaceholder("This app uses your location to show nearby restaurants and stores."))
    }
    
    // MARK: - Error Handling
    
    func testParseInvalidPlist() {
        let invalidData = "not a plist".data(using: .utf8)!
        
        XCTAssertThrowsError(try InfoPlistParser.parse(data: invalidData)) { error in
            guard case InfoPlistParser.ParseError.invalidFormat = error else {
                XCTFail("Expected invalidFormat error")
                return
            }
        }
    }
    
    func testParseArrayRootThrows() {
        let arrayPlist = """
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
        <plist version="1.0">
        <array>
            <string>item1</string>
            <string>item2</string>
        </array>
        </plist>
        """
        
        let data = arrayPlist.data(using: .utf8)!
        
        XCTAssertThrowsError(try InfoPlistParser.parse(data: data)) { error in
            guard case InfoPlistParser.ParseError.invalidFormat(_, let reason) = error else {
                XCTFail("Expected invalidFormat error")
                return
            }
            XCTAssertTrue(reason.contains("not a dictionary"))
        }
    }
}
