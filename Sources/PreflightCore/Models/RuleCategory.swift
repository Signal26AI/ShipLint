import Foundation

/// Category for organizing rules.
///
/// Categories group related rules for filtering and display.
public enum RuleCategory: String, Codable, CaseIterable, Sendable {
    case privacy
    case auth
    case permissions
    case completeness
    case metadata
    case features
    case code
    case iap
    
    /// Human-readable display name.
    public var displayName: String {
        switch self {
        case .privacy: return "Privacy"
        case .auth: return "Authentication"
        case .permissions: return "Permissions"
        case .completeness: return "Completeness"
        case .metadata: return "Metadata"
        case .features: return "Features"
        case .code: return "Code Quality"
        case .iap: return "In-App Purchase"
        }
    }
    
    /// Apple Review Guideline section reference.
    public var guidelineSection: String {
        switch self {
        case .privacy: return "5.1"
        case .auth: return "4.8"
        case .permissions: return "5.1.1"
        case .completeness: return "2.1"
        case .metadata: return "2.3"
        case .features: return "Various"
        case .code: return "2.5"
        case .iap: return "3.1"
        }
    }
}
