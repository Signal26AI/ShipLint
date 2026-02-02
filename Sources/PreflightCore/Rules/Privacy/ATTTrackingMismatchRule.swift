import Foundation

/// Rule that checks for tracking SDKs without App Tracking Transparency implementation.
///
/// This rule detects when an app includes tracking/attribution SDKs but is missing
/// NSUserTrackingUsageDescription in Info.plist and/or the AppTrackingTransparency
/// framework.
///
/// ## App Store Review Guideline
///
/// Guideline 5.1.2(i) - User Privacy and Data Use:
/// Apps that track users across apps/websites must use App Tracking Transparency
/// framework and disclose tracking.
///
/// ## Detection Logic
///
/// 1. Scan dependencies for known tracking SDKs (Facebook, Adjust, AppsFlyer, etc.)
/// 2. Check if NSUserTrackingUsageDescription exists in Info.plist
/// 3. Check if AppTrackingTransparency framework is linked
/// 4. Flag if tracking SDK present but ATT not implemented
///
/// ## Example Violation
///
/// An app that includes the Facebook SDK or Adjust without implementing
/// App Tracking Transparency will be rejected.
public struct ATTTrackingMismatchRule: Rule {
    
    // MARK: - Rule Protocol
    
    public let id = "privacy-003-att-tracking-mismatch"
    public let name = "Tracking SDK Without App Tracking Transparency"
    public let category = RuleCategory.privacy
    public let severity = Severity.critical
    public let confidence = Confidence.high
    public let guidelineReference = "5.1.2"
    
    /// The Info.plist key for tracking usage description.
    private static let trackingUsageKey = "NSUserTrackingUsageDescription"
    
    /// The framework required for ATT.
    private static let attFramework = "AppTrackingTransparency"
    
    public init() {}
    
    // MARK: - Evaluation
    
    public func evaluate(context: ScanContext) async throws -> [Finding] {
        // Detect tracking SDKs from dependencies
        let detectedSDKs = FrameworkDetector.detectTrackingSDKs(in: context.dependencies)
        
        guard !detectedSDKs.isEmpty else {
            // No tracking SDKs detected, rule doesn't apply
            return []
        }
        
        var findings: [Finding] = []
        
        // Check for ATT purpose string
        let hasTrackingDescription = context.plistString(for: Self.trackingUsageKey) != nil
        
        // Check for ATT framework
        let hasATTFramework = context.hasFramework(Self.attFramework)
        
        // Check tracking description validity
        let trackingDescription = context.plistString(for: Self.trackingUsageKey)
        
        // Case 1: Missing NSUserTrackingUsageDescription entirely
        if !hasTrackingDescription {
            findings.append(makeFinding(
                description: """
                    Your app includes tracking/attribution SDKs (\(detectedSDKs.joined(separator: ", "))) \
                    but Info.plist is missing NSUserTrackingUsageDescription. Since iOS 14.5, apps that track \
                    users must implement App Tracking Transparency and include a purpose string.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Add NSUserTrackingUsageDescription to your Info.plist:
                    
                    <key>NSUserTrackingUsageDescription</key>
                    <string>We use tracking to show you personalized ads and measure ad effectiveness.</string>
                    
                    Then implement the ATT prompt in your code:
                    
                    import AppTrackingTransparency
                    
                    ATTrackingManager.requestTrackingAuthorization { status in
                        switch status {
                        case .authorized:
                            // Enable tracking
                        default:
                            // Disable tracking
                        }
                    }
                    
                    Important: Only initialize tracking SDKs after the user grants permission.
                    """,
                documentationURL: "https://developer.apple.com/documentation/apptrackingtransparency"
            ))
        }
        // Case 2: Description is empty
        else if let desc = trackingDescription, desc.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            findings.append(makeFinding(
                title: "Empty Tracking Usage Description",
                description: """
                    NSUserTrackingUsageDescription exists but is empty. Apple requires a meaningful \
                    description explaining why your app tracks users.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Update NSUserTrackingUsageDescription with a clear explanation of your tracking purpose.
                    
                    Good example: "Allow tracking to receive personalized ads based on your interests."
                    Bad example: "" or "For tracking"
                    
                    Be specific about what data is collected and how it's used.
                    """,
                documentationURL: "https://developer.apple.com/documentation/apptrackingtransparency"
            ))
        }
        // Case 3: Description is placeholder
        else if let desc = trackingDescription, InfoPlistParser.isPlaceholder(desc) {
            findings.append(makeFinding(
                title: "Placeholder Tracking Usage Description",
                description: """
                    NSUserTrackingUsageDescription appears to contain placeholder text: "\(desc)". \
                    Apple requires meaningful, user-facing descriptions.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Replace the placeholder with a real explanation of why your app tracks users.
                    
                    Current value: "\(desc)"
                    
                    Users should understand what tracking means for their privacy.
                    """,
                documentationURL: "https://developer.apple.com/documentation/apptrackingtransparency"
            ))
        }
        
        // Case 4: Has description but no ATT framework (might indicate incomplete implementation)
        if hasTrackingDescription && !hasATTFramework {
            // This is a lower-confidence finding - they might have ATT imported elsewhere
            findings.append(Finding(
                ruleId: id,
                severity: .medium,
                confidence: .medium,
                title: "AppTrackingTransparency Framework Not Linked",
                description: """
                    Your app has NSUserTrackingUsageDescription but AppTrackingTransparency framework \
                    does not appear to be linked. This may indicate an incomplete ATT implementation.
                    """,
                location: "Project",
                guideline: guidelineReference,
                fixGuidance: """
                    Ensure you're importing AppTrackingTransparency in your code and actually showing \
                    the tracking permission prompt to users.
                    
                    import AppTrackingTransparency
                    
                    // Call this at an appropriate time (not immediately at launch)
                    ATTrackingManager.requestTrackingAuthorization { status in
                        // Handle response
                    }
                    
                    Note: If you're using a different approach to ATT (like via a third-party SDK wrapper), \
                    you can ignore this finding.
                    """,
                documentationURL: "https://developer.apple.com/documentation/apptrackingtransparency"
            ))
        }
        
        return findings
    }
}
