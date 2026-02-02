import Foundation

/// Utility to detect linked frameworks and dependencies in iOS projects.
///
/// `FrameworkDetector` analyzes project.pbxproj, Podfile.lock, and Package.resolved
/// to identify all frameworks and third-party dependencies used by an app.
///
/// ## Example
///
/// ```swift
/// // Detect frameworks from project
/// let frameworks = try FrameworkDetector.detectFrameworks(in: projectURL)
///
/// // Detect dependencies from Podfile.lock
/// let pods = try FrameworkDetector.parsePodfileLock(at: podfileLockURL)
/// ```
public enum FrameworkDetector {
    
    // MARK: - Known SDK Patterns
    
    /// Known tracking SDK patterns for ATT detection.
    public static let trackingSDKPatterns: [(pattern: String, name: String)] = [
        // Facebook/Meta
        ("FBSDKCoreKit", "Facebook SDK"),
        ("FacebookCore", "Facebook SDK"),
        ("FBAudienceNetwork", "Facebook Audience Network"),
        // Google
        ("GoogleAnalytics", "Google Analytics"),
        ("FirebaseAnalytics", "Firebase Analytics"),
        ("Firebase/Analytics", "Firebase Analytics"),
        ("Google-Mobile-Ads-SDK", "Google Mobile Ads"),
        ("GoogleMobileAds", "Google Mobile Ads"),
        // Attribution/Analytics
        ("Adjust", "Adjust"),
        ("AppsFlyer", "AppsFlyer"),
        ("AppsFlyerFramework", "AppsFlyer"),
        ("Branch", "Branch.io"),
        ("Amplitude", "Amplitude"),
        ("amplitude-ios", "Amplitude"),
        ("Mixpanel", "Mixpanel"),
        ("Segment", "Segment"),
        ("Singular", "Singular"),
        ("Kochava", "Kochava"),
        ("Tenjin", "Tenjin"),
    ]
    
    /// Known social login SDK patterns for SIWA detection.
    public static let socialLoginSDKPatterns: [(pattern: String, name: String)] = [
        // Google Sign-In
        ("GoogleSignIn", "Google Sign-In"),
        ("GIDSignIn", "Google Sign-In"),
        // Facebook Login
        ("FBSDKLoginKit", "Facebook Login"),
        ("FacebookLogin", "Facebook Login"),
        // Twitter/X
        ("TwitterKit", "Twitter Login"),
        // Firebase Auth (may include social)
        ("FirebaseAuth", "Firebase Auth"),
        ("Firebase/Auth", "Firebase Auth"),
        // Auth0
        ("Auth0", "Auth0"),
        // Amazon
        ("LoginWithAmazon", "Login with Amazon"),
        // LinkedIn
        ("linkedin-sdk", "LinkedIn Login"),
    ]
    
    /// Location-related frameworks.
    public static let locationFrameworks: Set<String> = [
        "CoreLocation",
        "MapKit",
    ]
    
    /// Camera-related frameworks.
    public static let cameraFrameworks: Set<String> = [
        "AVFoundation",
        "AVKit",
        "VisionKit",
    ]
    
    // MARK: - Errors
    
    /// Errors during framework detection.
    public enum DetectionError: LocalizedError {
        case fileNotFound(path: String)
        case parseError(path: String, reason: String)
        
        public var errorDescription: String? {
            switch self {
            case .fileNotFound(let path):
                return "File not found: \(path)"
            case .parseError(let path, let reason):
                return "Parse error at \(path): \(reason)"
            }
        }
    }
    
    // MARK: - Podfile.lock Parsing
    
    /// Parses Podfile.lock to extract CocoaPods dependencies.
    ///
    /// - Parameter url: Path to the Podfile.lock file.
    /// - Returns: Array of dependencies.
    /// - Throws: `DetectionError` if parsing fails.
    public static func parsePodfileLock(at url: URL) throws -> [Dependency] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw DetectionError.fileNotFound(path: url.path)
        }
        
        let content: String
        do {
            content = try String(contentsOf: url, encoding: .utf8)
        } catch {
            throw DetectionError.parseError(path: url.path, reason: error.localizedDescription)
        }
        
        return parsePodfileLockContent(content)
    }
    
    /// Parses Podfile.lock content string.
    ///
    /// - Parameter content: The Podfile.lock file content.
    /// - Returns: Array of dependencies.
    public static func parsePodfileLockContent(_ content: String) -> [Dependency] {
        var dependencies: [Dependency] = []
        let lines = content.components(separatedBy: .newlines)
        
        var inPodsSection = false
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            // Start of PODS section
            if trimmed == "PODS:" {
                inPodsSection = true
                continue
            }
            
            // End of PODS section (next top-level key)
            if inPodsSection && !line.hasPrefix(" ") && !line.hasPrefix("\t") && trimmed.hasSuffix(":") {
                break
            }
            
            // Parse pod entry
            if inPodsSection && line.hasPrefix("  - ") {
                // Format: "  - PodName (version)" or "  - PodName/Subspec (version)"
                let entry = line.dropFirst(4) // Remove "  - "
                
                // Match: "PodName (version)" or "PodName/Subspec (version)"
                if let match = entry.range(of: #"^([^\s(]+)\s*\(([^)]+)\)"#, options: .regularExpression) {
                    let fullMatch = String(entry[match])
                    
                    // Extract name and version
                    if let openParen = fullMatch.firstIndex(of: "("),
                       let closeParen = fullMatch.firstIndex(of: ")") {
                        let name = String(fullMatch[..<openParen]).trimmingCharacters(in: .whitespaces)
                        let version = String(fullMatch[fullMatch.index(after: openParen)..<closeParen])
                        
                        // Only add top-level pods (not subspecs like "Firebase/Analytics")
                        let baseName = name.components(separatedBy: "/").first ?? name
                        
                        // Avoid duplicates
                        if !dependencies.contains(where: { $0.name == baseName }) {
                            dependencies.append(Dependency(
                                name: baseName,
                                version: version,
                                source: .cocoapods
                            ))
                        }
                        
                        // Also track the full name for subspec matching
                        if name.contains("/") && !dependencies.contains(where: { $0.name == name }) {
                            dependencies.append(Dependency(
                                name: name,
                                version: version,
                                source: .cocoapods
                            ))
                        }
                    }
                }
            }
        }
        
        return dependencies
    }
    
    // MARK: - Package.resolved Parsing
    
    /// Parses Package.resolved to extract SPM dependencies.
    ///
    /// - Parameter url: Path to the Package.resolved file.
    /// - Returns: Array of dependencies.
    /// - Throws: `DetectionError` if parsing fails.
    public static func parsePackageResolved(at url: URL) throws -> [Dependency] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw DetectionError.fileNotFound(path: url.path)
        }
        
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw DetectionError.parseError(path: url.path, reason: error.localizedDescription)
        }
        
        return try parsePackageResolvedData(data)
    }
    
    /// Parses Package.resolved JSON data.
    ///
    /// - Parameter data: The JSON data.
    /// - Returns: Array of dependencies.
    /// - Throws: `DetectionError` if parsing fails.
    public static func parsePackageResolvedData(_ data: Data) throws -> [Dependency] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw DetectionError.parseError(path: "Package.resolved", reason: "Invalid JSON")
        }
        
        var dependencies: [Dependency] = []
        
        // Try version 2 format first (newer)
        if let pins = json["pins"] as? [[String: Any]] {
            for pin in pins {
                if let identity = pin["identity"] as? String,
                   let state = pin["state"] as? [String: Any] {
                    let version = state["version"] as? String
                    dependencies.append(Dependency(
                        name: identity,
                        version: version,
                        source: .spm
                    ))
                }
            }
        }
        // Try version 1 format (older)
        else if let object = json["object"] as? [String: Any],
                let pins = object["pins"] as? [[String: Any]] {
            for pin in pins {
                if let package = pin["package"] as? String,
                   let state = pin["state"] as? [String: Any] {
                    let version = state["version"] as? String
                    dependencies.append(Dependency(
                        name: package,
                        version: version,
                        source: .spm
                    ))
                }
            }
        }
        
        return dependencies
    }
    
    // MARK: - Project.pbxproj Parsing
    
    /// Extracts linked frameworks from project.pbxproj.
    ///
    /// - Parameter url: Path to the project.pbxproj file.
    /// - Returns: Set of framework names.
    /// - Throws: `DetectionError` if parsing fails.
    public static func parseProjectFrameworks(at url: URL) throws -> Set<String> {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw DetectionError.fileNotFound(path: url.path)
        }
        
        let content: String
        do {
            content = try String(contentsOf: url, encoding: .utf8)
        } catch {
            throw DetectionError.parseError(path: url.path, reason: error.localizedDescription)
        }
        
        return parseProjectFrameworksContent(content)
    }
    
    /// Parses project.pbxproj content to extract linked frameworks.
    ///
    /// - Parameter content: The project file content.
    /// - Returns: Set of framework names.
    public static func parseProjectFrameworksContent(_ content: String) -> Set<String> {
        var frameworks: Set<String> = []
        
        // Pattern 1: Framework file references like "AVFoundation.framework"
        let frameworkPattern = #"(\w+)\.framework"#
        if let regex = try? NSRegularExpression(pattern: frameworkPattern) {
            let range = NSRange(content.startIndex..., in: content)
            let matches = regex.matches(in: content, range: range)
            
            for match in matches {
                if let nameRange = Range(match.range(at: 1), in: content) {
                    frameworks.insert(String(content[nameRange]))
                }
            }
        }
        
        // Pattern 2: PRODUCT_BUNDLE_IDENTIFIER style (for linked frameworks)
        // Pattern 3: LD_RUNPATH_SEARCH_PATHS and FRAMEWORK_SEARCH_PATHS
        
        return frameworks
    }
    
    // MARK: - SDK Detection Helpers
    
    /// Detects tracking SDKs from a list of dependencies.
    ///
    /// - Parameter dependencies: The dependencies to check.
    /// - Returns: Array of detected tracking SDK names.
    public static func detectTrackingSDKs(in dependencies: [Dependency]) -> [String] {
        var detected: [String] = []
        
        for (pattern, name) in trackingSDKPatterns {
            let found = dependencies.contains { dep in
                dep.name.localizedCaseInsensitiveContains(pattern)
            }
            if found && !detected.contains(name) {
                detected.append(name)
            }
        }
        
        return detected
    }
    
    /// Detects social login SDKs from a list of dependencies.
    ///
    /// - Parameter dependencies: The dependencies to check.
    /// - Returns: Array of detected social login SDK names.
    public static func detectSocialLoginSDKs(in dependencies: [Dependency]) -> [String] {
        var detected: [String] = []
        
        for (pattern, name) in socialLoginSDKPatterns {
            let found = dependencies.contains { dep in
                dep.name.localizedCaseInsensitiveContains(pattern)
            }
            if found && !detected.contains(name) {
                detected.append(name)
            }
        }
        
        return detected
    }
    
    /// Checks if any tracking SDK is present.
    ///
    /// - Parameter dependencies: The dependencies to check.
    /// - Returns: True if any tracking SDK is detected.
    public static func hasTrackingSDK(in dependencies: [Dependency]) -> Bool {
        !detectTrackingSDKs(in: dependencies).isEmpty
    }
    
    /// Checks if any social login SDK is present.
    ///
    /// - Parameter dependencies: The dependencies to check.
    /// - Returns: True if any social login SDK is detected.
    public static func hasSocialLoginSDK(in dependencies: [Dependency]) -> Bool {
        !detectSocialLoginSDKs(in: dependencies).isEmpty
    }
    
    /// Checks if a specific SDK pattern is present.
    ///
    /// - Parameters:
    ///   - pattern: The pattern to match.
    ///   - dependencies: The dependencies to check.
    /// - Returns: True if the pattern is found.
    public static func hasSDK(matching pattern: String, in dependencies: [Dependency]) -> Bool {
        dependencies.contains { dep in
            dep.name.localizedCaseInsensitiveContains(pattern)
        }
    }
    
    // MARK: - Convenience Methods
    
    /// Loads all dependencies from a project directory.
    ///
    /// - Parameter projectDir: The project directory.
    /// - Returns: Combined array of dependencies from all sources.
    public static func loadAllDependencies(in projectDir: URL) -> [Dependency] {
        var all: [Dependency] = []
        
        // Try Podfile.lock
        let podfileLock = projectDir.appendingPathComponent("Podfile.lock")
        if let pods = try? parsePodfileLock(at: podfileLock) {
            all.append(contentsOf: pods)
        }
        
        // Try Package.resolved (in various locations)
        let packageResolvedLocations = [
            projectDir.appendingPathComponent("Package.resolved"),
            projectDir.appendingPathComponent(".swiftpm/Package.resolved"),
        ]
        
        for location in packageResolvedLocations {
            if let spm = try? parsePackageResolved(at: location) {
                all.append(contentsOf: spm)
                break
            }
        }
        
        return all
    }
}
