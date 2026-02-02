import Foundation

/// A rule that evaluates a scan context for potential issues.
///
/// Rules are the core unit of analysis in Preflight. Each rule checks
/// for a specific type of App Store Review Guideline violation.
///
/// ## Implementing a Rule
///
/// ```swift
/// struct MyCameraRule: Rule {
///     let id = "privacy-001-missing-camera-purpose"
///     let name = "Missing Camera Usage Description"
///     let category = RuleCategory.privacy
///     let severity = Severity.critical
///     let confidence = Confidence.high
///     let guidelineReference = "5.1.1"
///
///     func evaluate(context: ScanContext) async throws -> [Finding] {
///         // Check for camera framework without purpose string
///         guard context.hasFramework("AVFoundation") else {
///             return []
///         }
///         
///         if context.plistString(for: "NSCameraUsageDescription") == nil {
///             return [Finding(...)]
///         }
///         return []
///     }
/// }
/// ```
public protocol Rule: Sendable {
    /// Unique identifier for this rule (e.g., "privacy-001-missing-camera-purpose").
    var id: String { get }
    
    /// Human-readable name of the rule.
    var name: String { get }
    
    /// Category this rule belongs to.
    var category: RuleCategory { get }
    
    /// Severity of findings produced by this rule.
    var severity: Severity { get }
    
    /// Default confidence level for findings from this rule.
    var confidence: Confidence { get }
    
    /// Apple Review Guideline reference (e.g., "5.1.1").
    var guidelineReference: String { get }
    
    /// Evaluates the rule against the given context.
    ///
    /// - Parameter context: The scan context containing project data.
    /// - Returns: Array of findings (empty if no issues detected).
    /// - Throws: If evaluation encounters an unrecoverable error.
    func evaluate(context: ScanContext) async throws -> [Finding]
}

/// Extension providing default implementations for Rule.
extension Rule {
    /// Creates a finding with this rule's default properties.
    ///
    /// - Parameters:
    ///   - title: Short title (defaults to rule name).
    ///   - description: Detailed description of the issue.
    ///   - location: File or location where issue was found.
    ///   - fixGuidance: How to fix the issue.
    ///   - documentationURL: Apple documentation link.
    /// - Returns: A new Finding instance.
    public func makeFinding(
        title: String? = nil,
        description: String,
        location: String? = nil,
        fixGuidance: String,
        documentationURL: String? = nil
    ) -> Finding {
        Finding(
            ruleId: id,
            severity: severity,
            confidence: confidence,
            title: title ?? name,
            description: description,
            location: location,
            guideline: guidelineReference,
            fixGuidance: fixGuidance,
            documentationURL: documentationURL
        )
    }
}
