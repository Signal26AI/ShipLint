import Foundation

/// Rule that checks for missing location usage description.
///
/// This rule detects when an app uses location-related frameworks or APIs
/// but is missing the required NSLocationWhenInUseUsageDescription or
/// NSLocationAlwaysAndWhenInUseUsageDescription in Info.plist.
///
/// ## App Store Review Guideline
///
/// Guideline 5.1.1 - Data Collection and Storage:
/// Apps must include purpose strings explaining why they need access to location services.
///
/// ## Detection Logic
///
/// 1. Check if CoreLocation or MapKit framework is linked
/// 2. Check if NSLocationWhenInUseUsageDescription exists (required for any location access)
/// 3. If Always permission detected, check for NSLocationAlwaysAndWhenInUseUsageDescription
/// 4. Check for empty or placeholder descriptions
///
/// ## Example Violation
///
/// An app that imports CoreLocation without having NSLocationWhenInUseUsageDescription
/// in its Info.plist will crash at runtime and be rejected during review.
public struct MissingLocationPurposeRule: Rule {
    
    // MARK: - Rule Protocol
    
    public let id = "privacy-002-missing-location-purpose"
    public let name = "Missing Location Usage Description"
    public let category = RuleCategory.privacy
    public let severity = Severity.critical
    public let confidence = Confidence.high
    public let guidelineReference = "5.1.1"
    
    /// Frameworks that indicate location usage.
    private static let locationFrameworks: Set<String> = [
        "CoreLocation",
        "MapKit",
    ]
    
    /// The required key for any location access.
    private static let whenInUseKey = "NSLocationWhenInUseUsageDescription"
    
    /// Required for Always permission (iOS 11+).
    private static let alwaysAndWhenInUseKey = "NSLocationAlwaysAndWhenInUseUsageDescription"
    
    /// Legacy key for Always permission (pre-iOS 11, still checked).
    private static let alwaysKey = "NSLocationAlwaysUsageDescription"
    
    public init() {}
    
    // MARK: - Evaluation
    
    public func evaluate(context: ScanContext) async throws -> [Finding] {
        // Check if any location-related framework is linked
        let usesLocationFramework = Self.locationFrameworks.contains { context.hasFramework($0) }
        
        guard usesLocationFramework else {
            // No location framework detected, rule doesn't apply
            return []
        }
        
        var findings: [Finding] = []
        let detectedFrameworks = Self.locationFrameworks.filter { context.hasFramework($0) }
        
        // Check for WhenInUse description (always required)
        let whenInUseDescription = context.plistString(for: Self.whenInUseKey)
        
        // Check if Always permission might be used
        let hasAlwaysDescription = context.hasPlistKey(Self.alwaysKey) ||
                                   context.hasPlistKey(Self.alwaysAndWhenInUseKey)
        
        // Case 1: Completely missing WhenInUse description
        if whenInUseDescription == nil {
            findings.append(makeFinding(
                description: """
                    Your app links against location-related frameworks (\(detectedFrameworks.joined(separator: ", "))) \
                    but Info.plist is missing NSLocationWhenInUseUsageDescription. Apps that access location services \
                    must provide a purpose string explaining why access is needed.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Add NSLocationWhenInUseUsageDescription to your Info.plist with a clear, user-facing explanation \
                    of why your app needs location access. For example:
                    
                    <key>NSLocationWhenInUseUsageDescription</key>
                    <string>We use your location to show nearby restaurants and provide directions.</string>
                    
                    This key is required for any location access. The description should explain the specific feature \
                    that uses location and be written from the user's perspective.
                    """,
                documentationURL: "https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services"
            ))
        }
        // Case 2: WhenInUse description is empty
        else if whenInUseDescription!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            findings.append(makeFinding(
                title: "Empty Location Usage Description",
                description: """
                    NSLocationWhenInUseUsageDescription exists in Info.plist but is empty. \
                    Apple requires a meaningful description explaining why your app needs location access.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Update NSLocationWhenInUseUsageDescription with a clear, specific explanation of why your app \
                    needs location access. Generic or empty descriptions will be rejected.
                    
                    Good example: "Find coffee shops near your current location."
                    Bad example: "Location access required" or ""
                    """,
                documentationURL: "https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services"
            ))
        }
        // Case 3: WhenInUse description is a placeholder
        else if InfoPlistParser.isPlaceholder(whenInUseDescription!) {
            findings.append(makeFinding(
                title: "Placeholder Location Usage Description",
                description: """
                    NSLocationWhenInUseUsageDescription appears to contain placeholder text: "\(whenInUseDescription!)". \
                    Apple requires meaningful, user-facing descriptions.
                    """,
                location: "Info.plist",
                fixGuidance: """
                    Replace the placeholder text with a clear explanation of why your app needs location access. \
                    The description should be specific to your app's features.
                    
                    Current value: "\(whenInUseDescription!)"
                    
                    Write a description that helps users understand what feature uses location and why.
                    """,
                documentationURL: "https://developer.apple.com/documentation/corelocation/requesting_authorization_to_use_location_services"
            ))
        }
        
        // Check Always permission configuration
        if hasAlwaysDescription {
            let alwaysAndWhenInUseDescription = context.plistString(for: Self.alwaysAndWhenInUseKey)
            
            // iOS 11+ requires NSLocationAlwaysAndWhenInUseUsageDescription for Always permission
            if alwaysAndWhenInUseDescription == nil {
                // Only flag if they have the legacy key but not the new one
                if context.hasPlistKey(Self.alwaysKey) {
                    findings.append(makeFinding(
                        title: "Missing Always And When In Use Description",
                        description: """
                            Your app has NSLocationAlwaysUsageDescription but is missing \
                            NSLocationAlwaysAndWhenInUseUsageDescription. Since iOS 11, both keys are required \
                            when requesting Always location permission.
                            """,
                        location: "Info.plist",
                        fixGuidance: """
                            Add NSLocationAlwaysAndWhenInUseUsageDescription to your Info.plist. This key is required \
                            for iOS 11+ when requesting Always permission.
                            
                            <key>NSLocationWhenInUseUsageDescription</key>
                            <string>See nearby places while you're using the app.</string>
                            
                            <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
                            <string>Send you alerts when you're near saved places, even when the app is closed.</string>
                            
                            Note: Always permission is heavily scrutinized. Only request it if you have a visible, \
                            continuous location feature like navigation or fitness tracking.
                            """,
                        documentationURL: "https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request"
                    ))
                }
            }
            // Case: Always description exists but is empty
            else if alwaysAndWhenInUseDescription!.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                findings.append(makeFinding(
                    title: "Empty Always Location Description",
                    description: """
                        NSLocationAlwaysAndWhenInUseUsageDescription exists but is empty. \
                        Apple requires a meaningful description for Always location access.
                        """,
                    location: "Info.plist",
                    fixGuidance: """
                        Provide a clear explanation of why your app needs Always location access. \
                        This should describe a user-facing feature that requires continuous location.
                        
                        Example: "Track your runs in the background so you can see your route even \
                        when the screen is off."
                        """,
                    documentationURL: "https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request"
                ))
            }
            // Case: Always description is a placeholder
            else if InfoPlistParser.isPlaceholder(alwaysAndWhenInUseDescription!) {
                findings.append(makeFinding(
                    title: "Placeholder Always Location Description",
                    description: """
                        NSLocationAlwaysAndWhenInUseUsageDescription contains placeholder text: \
                        "\(alwaysAndWhenInUseDescription!)".
                        """,
                    location: "Info.plist",
                    fixGuidance: """
                        Replace the placeholder with a real description of your continuous location feature. \
                        Always permission requires a clear, user-visible justification.
                        """,
                    documentationURL: "https://developer.apple.com/documentation/corelocation/choosing_the_location_services_authorization_to_request"
                ))
            }
        }
        
        return findings
    }
}
