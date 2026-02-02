import XCTest
@testable import PreflightCore

final class SeverityTests: XCTestCase {
    
    // MARK: - Comparison
    
    func testSeverityComparison() {
        XCTAssertTrue(Severity.info < Severity.low)
        XCTAssertTrue(Severity.low < Severity.medium)
        XCTAssertTrue(Severity.medium < Severity.high)
        XCTAssertTrue(Severity.high < Severity.critical)
    }
    
    func testSeverityEquality() {
        XCTAssertEqual(Severity.critical, Severity.critical)
        XCTAssertNotEqual(Severity.critical, Severity.high)
    }
    
    // MARK: - Display Names
    
    func testDisplayNames() {
        XCTAssertEqual(Severity.critical.displayName, "Critical")
        XCTAssertEqual(Severity.high.displayName, "High")
        XCTAssertEqual(Severity.medium.displayName, "Medium")
        XCTAssertEqual(Severity.low.displayName, "Low")
        XCTAssertEqual(Severity.info.displayName, "Info")
    }
    
    // MARK: - Codable
    
    func testSeverityCodable() throws {
        let encoder = JSONEncoder()
        let decoder = JSONDecoder()
        
        for severity in Severity.allCases {
            let data = try encoder.encode(severity)
            let decoded = try decoder.decode(Severity.self, from: data)
            XCTAssertEqual(severity, decoded)
        }
    }
}

final class ConfidenceTests: XCTestCase {
    
    func testConfidenceComparison() {
        XCTAssertTrue(Confidence.low < Confidence.medium)
        XCTAssertTrue(Confidence.medium < Confidence.high)
    }
    
    func testConfidenceDisplayNames() {
        XCTAssertEqual(Confidence.high.displayName, "High")
        XCTAssertEqual(Confidence.medium.displayName, "Medium")
        XCTAssertEqual(Confidence.low.displayName, "Low")
    }
}
