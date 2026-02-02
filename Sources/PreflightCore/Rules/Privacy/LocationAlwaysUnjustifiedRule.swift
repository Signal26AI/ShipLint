import Foundation

/// Rule that checks for Always location permission without proper justification.
///
/// This rule detects when an app requests Always location permission but doesn't
/// have the "location" background mode enabled in UIBackgroundModes, which strongly
/// suggests the app doesn't have a legitimate continuous location feature.
///
/// ## App Store Review Guideline
///
/// Guideline 5.1.1 - Data Collection and Storage:
/// Apps requesting Always location permission must have a visible, continuous
/// location-based feature that justifies background access.
///
/// ## Detection Logic
///
/// 1. Check for NSLocationAlwaysUsageDescription or NSLocationAlwaysAndWhenInUseUsageDescription
/// 2. Check if UIBackgroundModes contains "location"
/// 3. Flag if Always permission requested without background location mode
///
/// ## Example Violation
///
/// An app with NSLocationAlwaysAndWhenInUseUsageDescription but no "location" in
/// UIBackgroundModes is likely to be rejected, as Always permission without
/// background mode suggests no legitimate continuous location feature.
public struct LocationAlwaysUnjustifiedRule: Rule {
    
    // MARK: - Rule Protocol
    
    public let id = "entitlements-001-location-always-unjustified"
    public let name = "Location Always Permission Without Justification"
    public let category = RuleCategory.privacy
    public let severity = Severity.critical
    public let confidence = Confidence.medium  // Heuristic-based
    public let guidelineReference = "5.1.1"
    
    /// Keys that indicate Always location permission.
    private static let alwaysKeys = [
        "NSLocationAlwaysUsageDescription",
        "NSLocationAlwaysAndWhenInUseUsageDescription"
    ]
    
    /// The background mode key.
    private static let backgroundModesKey = "UIBackgroundModes"
    
    /// The location background mode value.
    private static let locationBackgroundMode = "location"
    
    public init() {}
    
    // MARK: - Evaluation
    
    public func evaluate(context: ScanContext) async throws -> [Finding] {
        // Check if app requests Always location permission
        let hasAlwaysPermission = Self.alwaysKeys.contains { context.hasPlistKey($0) }
        
        guard hasAlwaysPermission else {
            // No Always permission requested, rule doesn't apply
            return []
        }
        
        // Check if background location mode is enabled
        let backgroundModes = context.plistArray(for: Self.backgroundModesKey) as? [String] ?? []
        let hasLocationBackgroundMode = backgroundModes.contains(Self.locationBackgroundMode)
        
        var findings: [Finding] = []
        
        // Case 1: Always permission without background location mode
        if !hasLocationBackgroundMode {
            // Determine which Always key is present
            let presentKeys = Self.alwaysKeys.filter { context.hasPlistKey($0) }
            
            findings.append(makeFinding(
                description: """
                    Your app requests Always location permission (\(presentKeys.joined(separator: ", "))) \
                    but UIBackgroundModes does not include "location". This configuration strongly suggests \
                    your app doesn't have a legitimate continuous location feature, which Apple will \
                    likely question during review.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    You have two options:
                    
                    **Option 1: If you DO need Always permission (navigation, fitness, geofencing):**
                    
                    Add "location" to UIBackgroundModes in Info.plist:
                    
                    <key>UIBackgroundModes</key>
                    <array>
                        <string>location</string>
                    </array>
                    
                    Also ensure your app has a visible, user-initiated feature that uses continuous location \
                    (like run tracking or turn-by-turn navigation).
                    
                    **Option 2: If you DON'T need Always permission (most apps):**
                    
                    Switch to When In Use permission instead. Remove the Always description keys and \
                    use requestWhenInUseAuthorization() instead of requestAlwaysAuthorization().
                    
                    When In Use permission has a much higher approval rate and is sufficient for most \
                    location features.
                    
                    Note: Always permission is heavily scrutinized. Be prepared to justify your use case \
                    in App Store Review notes.
                    """,
                documentationURL: "https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request"
            ))
        }
        // Case 2: Has background mode but check for suspicious patterns
        else {
            // Check if the Always description seems appropriate
            let alwaysDesc = context.plistString(for: "NSLocationAlwaysAndWhenInUseUsageDescription") ??
                            context.plistString(for: "NSLocationAlwaysUsageDescription")
            
            if let desc = alwaysDesc {
                // Check for vague or non-continuous descriptions
                let lowercased = desc.lowercased()
                let vaguePatterns = [
                    "nearby",
                    "location services",
                    "your location",
                    "we need",
                    "is required"
                ]
                
                let seemsVague = vaguePatterns.contains { lowercased.contains($0) } &&
                                !lowercased.contains("track") &&
                                !lowercased.contains("background") &&
                                !lowercased.contains("navigation") &&
                                !lowercased.contains("running") &&
                                !lowercased.contains("workout") &&
                                !lowercased.contains("geofence") &&
                                !lowercased.contains("alert")
                
                if seemsVague {
                    findings.append(Finding(
                        ruleId: id,
                        severity: .medium,
                        confidence: .low,
                        title: "Always Location Description May Be Insufficient",
                        description: """
                            Your Always location description doesn't clearly explain a continuous \
                            location feature: "\(desc)". Apple expects clear justification for \
                            Always permission.
                            """,
                        location: "Info.plist",
                        guideline: guidelineReference,
                        fixGuidance: """
                            Update your description to clearly explain the continuous location feature:
                            
                            Good examples:
                            - "Track your runs in the background so you can see your complete route."
                            - "Provide turn-by-turn directions even when the screen is off."
                            - "Send alerts when you arrive at or leave saved locations."
                            
                            Bad examples:
                            - "We use your location" (too vague)
                            - "Location is required" (doesn't explain feature)
                            - "Show nearby places" (doesn't justify Always)
                            """,
                        documentationURL: "https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request"
                    ))
                }
            }
        }
        
        return findings
    }
}
