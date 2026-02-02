import Foundation

/// Result of a project scan.
///
/// `ScanResult` aggregates all findings from a scan and provides
/// summary statistics for reporting.
///
/// ## Example
///
/// ```swift
/// let result = try await scanner.scan(projectPath: projectURL)
/// print("Found \(result.findings.count) issues")
/// print("Critical: \(result.summary.critical)")
/// print("High: \(result.summary.high)")
/// ```
public struct ScanResult: Codable, Sendable {
    
    /// Version of the scanner that produced this result.
    public let version: String
    
    /// ISO 8601 timestamp of when the scan was performed.
    public let scanDate: String
    
    /// Path to the scanned project.
    public let projectPath: String
    
    /// Duration of the scan in milliseconds.
    public let scanDurationMs: Int
    
    /// Summary of findings by severity.
    public let summary: ScanSummary
    
    /// All findings from the scan.
    public let findings: [Finding]
    
    /// Creates a new scan result.
    ///
    /// - Parameters:
    ///   - version: Scanner version.
    ///   - scanDate: ISO 8601 timestamp.
    ///   - projectPath: Path to the scanned project.
    ///   - scanDurationMs: Scan duration in milliseconds.
    ///   - findings: Array of findings.
    public init(
        version: String = preflightVersion,
        scanDate: Date = Date(),
        projectPath: String,
        scanDurationMs: Int,
        findings: [Finding]
    ) {
        self.version = version
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        self.scanDate = formatter.string(from: scanDate)
        
        self.projectPath = projectPath
        self.scanDurationMs = scanDurationMs
        self.findings = findings
        self.summary = ScanSummary(from: findings)
    }
    
    /// Returns findings filtered by minimum severity.
    ///
    /// - Parameter minSeverity: Minimum severity to include.
    /// - Returns: Filtered array of findings.
    public func findings(minSeverity: Severity) -> [Finding] {
        findings.filter { $0.severity >= minSeverity }
    }
    
    /// Returns findings for a specific rule ID.
    ///
    /// - Parameter ruleId: The rule ID to filter by.
    /// - Returns: Filtered array of findings.
    public func findings(forRule ruleId: String) -> [Finding] {
        findings.filter { $0.ruleId == ruleId }
    }
    
    /// Returns findings grouped by severity.
    public var findingsBySeverity: [Severity: [Finding]] {
        Dictionary(grouping: findings, by: { $0.severity })
    }
    
    /// Whether the scan passed (no critical or high findings).
    public var passed: Bool {
        summary.critical == 0 && summary.high == 0
    }
}

/// Summary statistics for a scan.
public struct ScanSummary: Codable, Sendable {
    /// Number of critical findings.
    public let critical: Int
    
    /// Number of high severity findings.
    public let high: Int
    
    /// Number of medium severity findings.
    public let medium: Int
    
    /// Number of low severity findings.
    public let low: Int
    
    /// Number of informational findings.
    public let info: Int
    
    /// Total number of findings.
    public let total: Int
    
    /// Creates a summary from an array of findings.
    ///
    /// - Parameter findings: Array of findings to summarize.
    public init(from findings: [Finding]) {
        var criticalCount = 0
        var highCount = 0
        var mediumCount = 0
        var lowCount = 0
        var infoCount = 0
        
        for finding in findings {
            switch finding.severity {
            case .critical: criticalCount += 1
            case .high: highCount += 1
            case .medium: mediumCount += 1
            case .low: lowCount += 1
            case .info: infoCount += 1
            }
        }
        
        self.critical = criticalCount
        self.high = highCount
        self.medium = mediumCount
        self.low = lowCount
        self.info = infoCount
        self.total = findings.count
    }
    
    /// Creates a summary with explicit counts.
    public init(critical: Int, high: Int, medium: Int, low: Int, info: Int) {
        self.critical = critical
        self.high = high
        self.medium = medium
        self.low = low
        self.info = info
        self.total = critical + high + medium + low + info
    }
}
