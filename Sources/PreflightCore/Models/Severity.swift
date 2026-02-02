import Foundation

/// Severity level for findings.
///
/// Severity indicates the impact of a finding on App Store review outcome:
/// - `critical`: Almost certain rejection if not fixed
/// - `high`: Likely rejection, should be fixed before submission
/// - `medium`: May cause rejection depending on reviewer
/// - `low`: Unlikely to cause rejection but worth addressing
/// - `info`: Informational finding, no impact on review
public enum Severity: String, Codable, Comparable, CaseIterable, Sendable {
    case critical
    case high
    case medium
    case low
    case info
    
    /// Numeric weight for comparison (higher = more severe).
    private var weight: Int {
        switch self {
        case .critical: return 5
        case .high: return 4
        case .medium: return 3
        case .low: return 2
        case .info: return 1
        }
    }
    
    public static func < (lhs: Severity, rhs: Severity) -> Bool {
        lhs.weight < rhs.weight
    }
    
    /// Human-readable display name.
    public var displayName: String {
        rawValue.capitalized
    }
    
    /// ANSI color code for terminal output.
    public var ansiColor: String {
        switch self {
        case .critical: return "\u{001B}[31m" // Red
        case .high: return "\u{001B}[33m"     // Yellow
        case .medium: return "\u{001B}[35m"   // Magenta
        case .low: return "\u{001B}[36m"      // Cyan
        case .info: return "\u{001B}[37m"     // White
        }
    }
}

/// Confidence level for findings.
///
/// Confidence indicates how certain the tool is about the finding:
/// - `high`: Detection logic is definitive
/// - `medium`: Based on heuristics, may have false positives
/// - `low`: Best guess, review recommended
public enum Confidence: String, Codable, Comparable, CaseIterable, Sendable {
    case high
    case medium
    case low
    
    private var weight: Int {
        switch self {
        case .high: return 3
        case .medium: return 2
        case .low: return 1
        }
    }
    
    public static func < (lhs: Confidence, rhs: Confidence) -> Bool {
        lhs.weight < rhs.weight
    }
    
    /// Human-readable display name.
    public var displayName: String {
        rawValue.capitalized
    }
}
