import XCTest
@testable import PreflightCore

final class ScanResultTests: XCTestCase {
    
    // MARK: - Summary
    
    func testSummaryCountsCorrectly() {
        let findings: [Finding] = [
            makeFinding(severity: .critical),
            makeFinding(severity: .critical),
            makeFinding(severity: .high),
            makeFinding(severity: .medium),
            makeFinding(severity: .low),
            makeFinding(severity: .info),
            makeFinding(severity: .info),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertEqual(result.summary.critical, 2)
        XCTAssertEqual(result.summary.high, 1)
        XCTAssertEqual(result.summary.medium, 1)
        XCTAssertEqual(result.summary.low, 1)
        XCTAssertEqual(result.summary.info, 2)
        XCTAssertEqual(result.summary.total, 7)
    }
    
    // MARK: - Passed/Failed
    
    func testPassedWithNoHighOrCritical() {
        let findings: [Finding] = [
            makeFinding(severity: .medium),
            makeFinding(severity: .low),
            makeFinding(severity: .info),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertTrue(result.passed)
    }
    
    func testFailedWithCritical() {
        let findings: [Finding] = [
            makeFinding(severity: .critical),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertFalse(result.passed)
    }
    
    func testFailedWithHigh() {
        let findings: [Finding] = [
            makeFinding(severity: .high),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertFalse(result.passed)
    }
    
    // MARK: - Filtering
    
    func testFindingsMinSeverity() {
        let findings: [Finding] = [
            makeFinding(severity: .critical),
            makeFinding(severity: .high),
            makeFinding(severity: .medium),
            makeFinding(severity: .low),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertEqual(result.findings(minSeverity: .critical).count, 1)
        XCTAssertEqual(result.findings(minSeverity: .high).count, 2)
        XCTAssertEqual(result.findings(minSeverity: .medium).count, 3)
        XCTAssertEqual(result.findings(minSeverity: .low).count, 4)
    }
    
    func testFindingsForRule() {
        let findings: [Finding] = [
            makeFinding(ruleId: "rule-001"),
            makeFinding(ruleId: "rule-001"),
            makeFinding(ruleId: "rule-002"),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        XCTAssertEqual(result.findings(forRule: "rule-001").count, 2)
        XCTAssertEqual(result.findings(forRule: "rule-002").count, 1)
        XCTAssertEqual(result.findings(forRule: "rule-999").count, 0)
    }
    
    // MARK: - Grouping
    
    func testFindingsBySeverity() {
        let findings: [Finding] = [
            makeFinding(severity: .critical),
            makeFinding(severity: .critical),
            makeFinding(severity: .high),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 100,
            findings: findings
        )
        
        let grouped = result.findingsBySeverity
        
        XCTAssertEqual(grouped[.critical]?.count, 2)
        XCTAssertEqual(grouped[.high]?.count, 1)
        XCTAssertNil(grouped[.medium])
    }
    
    // MARK: - Codable
    
    func testScanResultCodable() throws {
        let findings: [Finding] = [
            makeFinding(severity: .critical),
            makeFinding(severity: .high),
        ]
        
        let result = ScanResult(
            projectPath: "/test/path",
            scanDurationMs: 123,
            findings: findings
        )
        
        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        let data = try encoder.encode(result)
        
        let decoder = JSONDecoder()
        let decoded = try decoder.decode(ScanResult.self, from: data)
        
        XCTAssertEqual(decoded.version, result.version)
        XCTAssertEqual(decoded.projectPath, result.projectPath)
        XCTAssertEqual(decoded.scanDurationMs, result.scanDurationMs)
        XCTAssertEqual(decoded.findings.count, result.findings.count)
        XCTAssertEqual(decoded.summary.critical, result.summary.critical)
    }
    
    // MARK: - Helpers
    
    private func makeFinding(
        ruleId: String = "test-rule",
        severity: Severity = .medium
    ) -> Finding {
        Finding(
            ruleId: ruleId,
            severity: severity,
            confidence: .high,
            title: "Test Finding",
            description: "Test description",
            guideline: "1.0",
            fixGuidance: "Fix it"
        )
    }
}
