import Foundation

/// A single finding from a rule evaluation.
///
/// `Finding` represents an issue detected by a rule. It contains all the
/// information needed to understand the problem and how to fix it.
///
/// ## Example
///
/// ```swift
/// let finding = Finding(
///     ruleId: "privacy-001-missing-camera-purpose",
///     severity: .critical,
///     confidence: .high,
///     title: "Missing Camera Usage Description",
///     description: "Your app uses AVFoundation but Info.plist is missing NSCameraUsageDescription",
///     location: "Info.plist",
///     guideline: "5.1.1",
///     fixGuidance: "Add NSCameraUsageDescription key to Info.plist with a user-facing explanation..."
/// )
/// ```
public struct Finding: Codable, Sendable, Equatable, Identifiable {
    
    /// Unique identifier combining rule ID and location.
    public var id: String {
        if let location = location {
            return "\(ruleId):\(location)"
        }
        return ruleId
    }
    
    /// The ID of the rule that generated this finding.
    public let ruleId: String
    
    /// Severity level of the finding.
    public let severity: Severity
    
    /// Confidence level of the finding.
    public let confidence: Confidence
    
    /// Short title describing the issue.
    public let title: String
    
    /// Detailed description of the issue.
    public let description: String
    
    /// File or location where the issue was found (optional).
    public let location: String?
    
    /// Apple Review Guideline reference (e.g., "5.1.1").
    public let guideline: String
    
    /// Actionable guidance on how to fix the issue.
    public let fixGuidance: String
    
    /// URL to relevant Apple documentation (optional).
    public let documentationURL: String?
    
    /// Creates a new finding.
    ///
    /// - Parameters:
    ///   - ruleId: The ID of the rule that generated this finding.
    ///   - severity: Severity level of the finding.
    ///   - confidence: Confidence level of the finding.
    ///   - title: Short title describing the issue.
    ///   - description: Detailed description of the issue.
    ///   - location: File or location where the issue was found.
    ///   - guideline: Apple Review Guideline reference.
    ///   - fixGuidance: Actionable guidance on how to fix the issue.
    ///   - documentationURL: URL to relevant Apple documentation.
    public init(
        ruleId: String,
        severity: Severity,
        confidence: Confidence,
        title: String,
        description: String,
        location: String? = nil,
        guideline: String,
        fixGuidance: String,
        documentationURL: String? = nil
    ) {
        self.ruleId = ruleId
        self.severity = severity
        self.confidence = confidence
        self.title = title
        self.description = description
        self.location = location
        self.guideline = guideline
        self.fixGuidance = fixGuidance
        self.documentationURL = documentationURL
    }
}
