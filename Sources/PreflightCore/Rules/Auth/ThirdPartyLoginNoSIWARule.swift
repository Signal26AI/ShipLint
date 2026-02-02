import Foundation

/// Rule that checks for third-party login without Sign in with Apple.
///
/// This rule detects when an app includes social login SDKs (Google, Facebook, etc.)
/// but doesn't implement Sign in with Apple as an equivalent option.
///
/// ## App Store Review Guideline
///
/// Guideline 4.8 - Sign in with Apple:
/// Apps that use third-party social login must also offer Sign in with Apple
/// as an equivalent option.
///
/// ## Detection Logic
///
/// 1. Scan dependencies for social login SDKs (Google Sign-In, Facebook Login, etc.)
/// 2. Check for Sign in with Apple capability in entitlements
/// 3. Check for AuthenticationServices framework
/// 4. Flag if social login present without SIWA implementation
///
/// ## Example Violation
///
/// An app with Google Sign-In SDK but without the com.apple.developer.applesignin
/// entitlement and AuthenticationServices framework will be rejected.
///
/// ## Exemptions
///
/// Some apps are exempt from this requirement:
/// - Enterprise apps using company's own account system
/// - Education apps using school-issued credentials
/// - Government apps using citizen ID systems
/// - Games using only Game Center
/// - Apps with email/password only (no social login)
public struct ThirdPartyLoginNoSIWARule: Rule {
    
    // MARK: - Rule Protocol
    
    public let id = "auth-001-third-party-login-no-siwa"
    public let name = "Third-Party Login Without Sign in with Apple"
    public let category = RuleCategory.auth
    public let severity = Severity.critical
    public let confidence = Confidence.high
    public let guidelineReference = "4.8"
    
    /// Entitlement key for Sign in with Apple.
    private static let siwaEntitlementKey = "com.apple.developer.applesignin"
    
    /// Framework for Sign in with Apple.
    private static let authServicesFramework = "AuthenticationServices"
    
    public init() {}
    
    // MARK: - Evaluation
    
    public func evaluate(context: ScanContext) async throws -> [Finding] {
        // Detect social login SDKs
        let detectedSDKs = FrameworkDetector.detectSocialLoginSDKs(in: context.dependencies)
        
        // Filter out SDKs that might not require SIWA (Firebase Auth alone, Auth0 alone)
        // These MAY be used for email/password only, so we lower confidence for them
        let definitiveSocialSDKs = detectedSDKs.filter { sdk in
            !["Firebase Auth", "Auth0"].contains(sdk)
        }
        
        let ambiguousSDKs = detectedSDKs.filter { sdk in
            ["Firebase Auth", "Auth0"].contains(sdk)
        }
        
        guard !detectedSDKs.isEmpty else {
            // No social login SDKs detected, rule doesn't apply
            return []
        }
        
        // Check for SIWA capability
        let hasSIWAEntitlement = context.hasEntitlement(Self.siwaEntitlementKey)
        
        // Check for AuthenticationServices framework
        let hasAuthServices = context.hasFramework(Self.authServicesFramework)
        
        var findings: [Finding] = []
        
        // If definitive social SDKs are present (Google Sign-In, Facebook Login, etc.)
        if !definitiveSocialSDKs.isEmpty {
            // Case 1: No SIWA entitlement
            if !hasSIWAEntitlement {
                findings.append(makeFinding(
                    description: """
                        Your app includes third-party social login SDKs (\(definitiveSocialSDKs.joined(separator: ", "))) \
                        but the Sign in with Apple capability is not configured. According to App Store Review \
                        Guideline 4.8, apps that offer third-party social login must also offer Sign in with Apple \
                        as an equivalent option.
                        """,
                    location: "Entitlements",
                    fixGuidance: """
                        Add Sign in with Apple to your app:
                        
                        1. In Xcode, select your app target → Signing & Capabilities
                        2. Click "+ Capability" and add "Sign in with Apple"
                        3. Implement the SIWA UI alongside your existing login options:
                        
                        import AuthenticationServices
                        
                        // Add the Apple sign-in button to your login screen
                        let button = ASAuthorizationAppleIDButton(type: .signIn, style: .black)
                        button.addTarget(self, action: #selector(handleAppleSignIn), for: .touchUpInside)
                        
                        @objc func handleAppleSignIn() {
                            let provider = ASAuthorizationAppleIDProvider()
                            let request = provider.createRequest()
                            request.requestedScopes = [.fullName, .email]
                            
                            let controller = ASAuthorizationController(authorizationRequests: [request])
                            controller.delegate = self
                            controller.performRequests()
                        }
                        
                        Important: Sign in with Apple must be presented as an equivalent option - same \
                        prominence as other social login buttons.
                        """,
                    documentationURL: "https://developer.apple.com/sign-in-with-apple/"
                ))
            }
            // Case 2: Has entitlement but no AuthenticationServices framework
            else if !hasAuthServices {
                findings.append(Finding(
                    ruleId: id,
                    severity: .medium,
                    confidence: .medium,
                    title: "Sign in with Apple May Not Be Implemented",
                    description: """
                        Your app has the Sign in with Apple capability enabled but \
                        AuthenticationServices framework doesn't appear to be linked. This may indicate \
                        an incomplete SIWA implementation.
                        """,
                    location: "Project",
                    guideline: guidelineReference,
                    fixGuidance: """
                        Ensure you're importing AuthenticationServices and implementing the sign-in flow:
                        
                        import AuthenticationServices
                        
                        // Present the sign-in button and handle the flow
                        // See Apple's documentation for complete implementation
                        
                        Note: If you're using a third-party library that wraps SIWA, you can ignore \
                        this finding.
                        """,
                    documentationURL: "https://developer.apple.com/sign-in-with-apple/"
                ))
            }
        }
        
        // If only ambiguous SDKs (Firebase Auth, Auth0) - lower confidence
        if definitiveSocialSDKs.isEmpty && !ambiguousSDKs.isEmpty && !hasSIWAEntitlement {
            findings.append(Finding(
                ruleId: id,
                severity: .medium,
                confidence: .medium,
                title: "Potential Social Login Without Sign in with Apple",
                description: """
                    Your app includes authentication SDKs (\(ambiguousSDKs.joined(separator: ", "))) that may \
                    be configured for social login. If you offer Google, Facebook, or other social login \
                    options, you must also offer Sign in with Apple.
                    """,
                location: "Entitlements",
                guideline: guidelineReference,
                fixGuidance: """
                    Review your authentication implementation:
                    
                    **If you use social login (Google, Facebook, etc.):**
                    Add Sign in with Apple capability and implement it as an equivalent option.
                    
                    **If you only use email/password authentication:**
                    You're exempt from Guideline 4.8. Sign in with Apple is not required for \
                    apps that don't offer third-party social login.
                    
                    **If using Firebase Auth with social providers:**
                    Firebase supports Sign in with Apple - add it as a provider:
                    https://firebase.google.com/docs/auth/ios/apple
                    """,
                documentationURL: "https://developer.apple.com/sign-in-with-apple/"
            ))
        }
        
        return findings
    }
}
