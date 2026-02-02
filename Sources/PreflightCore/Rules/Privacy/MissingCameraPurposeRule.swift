import Foundation

/// Rule that checks for missing camera usage description.
///
/// This rule detects when an app uses camera-related frameworks or APIs
/// but is missing the required NSCameraUsageDescription in Info.plist.
///
/// ## App Store Review Guideline
///
/// Guideline 5.1.1 - Data Collection and Storage:
/// Apps that collect user or usage data must have a privacy policy and secure
/// user consent for the collection. Apps that access private data (photos,
/// contacts, location, etc.) must request user permission.
///
/// ## Detection Logic
///
/// 1. Check if AVFoundation framework is linked OR camera-related APIs detected
/// 2. Check if NSCameraUsageDescription exists in Info.plist
/// 3. Check if the description is non-empty and not a placeholder
///
/// ## Example Violation
///
/// An app that imports AVFoundation and accesses the camera without having
/// NSCameraUsageDescription in its Info.plist will be rejected.
public struct MissingCameraPurposeRule: Rule {
    
    // MARK: - Rule Protocol
    
    public let id = "privacy-001-missing-camera-purpose"
    public let name = "Missing Camera Usage Description"
    public let category = RuleCategory.privacy
    public let severity = Severity.critical
    public let confidence = Confidence.high
    public let guidelineReference = "5.1.1"
    
    /// Frameworks that indicate camera usage.
    private static let cameraFrameworks: Set<String> = [
        "AVFoundation",
        "AVKit",
        "VisionKit"  // Document scanner uses camera
    ]
    
    public init() {}
    
    // MARK: - Evaluation
    
    public func evaluate(context: ScanContext) async throws -> [Finding] {
        // Check if any camera-related framework is linked
        let usesCameraFramework = Self.cameraFrameworks.contains { context.hasFramework($0) }
        
        guard usesCameraFramework else {
            // No camera framework detected, rule doesn't apply
            return []
        }
        
        // Check for NSCameraUsageDescription in Info.plist
        let cameraDescription = context.plistString(for: "NSCameraUsageDescription")
        
        // Case 1: Completely missing
        if cameraDescription == nil {
            return [
                makeFinding(
                    description: """
                        Your app links against camera-related frameworks (\(detectedFrameworks(in: context).joined(separator: ", "))) \
                        but Info.plist is missing NSCameraUsageDescription. Apps that access the camera must \
                        provide a purpose string explaining why access is needed.
                        """,
                    location: "Info.plist",
                    fixGuidance: """
                        Add NSCameraUsageDescription to your Info.plist with a clear, user-facing explanation \
                        of why your app needs camera access. For example:
                        
                        <key>NSCameraUsageDescription</key>
                        <string>We need access to your camera to take photos for your profile.</string>
                        
                        The description should explain the specific feature that uses the camera and \
                        be written from the user's perspective.
                        """,
                    documentationURL: "https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription"
                )
            ]
        }
        
        // Case 2: Empty or whitespace only
        if cameraDescription!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return [
                makeFinding(
                    title: "Empty Camera Usage Description",
                    description: """
                        NSCameraUsageDescription exists in Info.plist but is empty. \
                        Apple requires a meaningful description explaining why your app needs camera access.
                        """,
                    location: "Info.plist",
                    fixGuidance: """
                        Update NSCameraUsageDescription with a clear, specific explanation of why your app \
                        needs camera access. Generic or empty descriptions may be rejected.
                        
                        Good example: "We use your camera to scan QR codes for quick login."
                        Bad example: "Camera access required" or ""
                        """,
                    documentationURL: "https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription"
                )
            ]
        }
        
        // Case 3: Placeholder text detected
        if InfoPlistParser.isPlaceholder(cameraDescription!) {
            return [
                makeFinding(
                    title: "Placeholder Camera Usage Description",
                    description: """
                        NSCameraUsageDescription appears to contain placeholder text: "\(cameraDescription!)". \
                        Apple requires meaningful, user-facing descriptions.
                        """,
                    location: "Info.plist",
                    fixGuidance: """
                        Replace the placeholder text with a clear explanation of why your app needs camera access. \
                        The description should be specific to your app's features.
                        
                        Current value: "\(cameraDescription!)"
                        
                        Write a description that helps users understand what feature uses the camera and why.
                        """,
                    documentationURL: "https://developer.apple.com/documentation/bundleresources/information_property_list/nscamerausagedescription"
                )
            ]
        }
        
        // All checks passed
        return []
    }
    
    // MARK: - Helpers
    
    /// Returns the camera-related frameworks detected in the context.
    private func detectedFrameworks(in context: ScanContext) -> [String] {
        Self.cameraFrameworks.filter { context.hasFramework($0) }
    }
}
