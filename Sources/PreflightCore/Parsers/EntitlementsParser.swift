import Foundation

/// Parser for .entitlements files.
///
/// `EntitlementsParser` reads and parses entitlements plist files, providing
/// access to capabilities like Sign in with Apple, HealthKit, push notifications,
/// and other App Store capabilities.
///
/// ## Example
///
/// ```swift
/// let entitlements = try EntitlementsParser.parse(at: entitlementsURL)
/// let hasSignInWithApple = EntitlementsParser.hasSignInWithApple(entitlements)
/// ```
public enum EntitlementsParser {
    
    // MARK: - Errors
    
    /// Errors that can occur during parsing.
    public enum ParseError: LocalizedError {
        case fileNotFound(path: String)
        case invalidFormat(path: String, reason: String)
        case readError(path: String, underlying: Error)
        
        public var errorDescription: String? {
            switch self {
            case .fileNotFound(let path):
                return "Entitlements file not found at: \(path)"
            case .invalidFormat(let path, let reason):
                return "Invalid entitlements format at \(path): \(reason)"
            case .readError(let path, let underlying):
                return "Error reading entitlements at \(path): \(underlying.localizedDescription)"
            }
        }
    }
    
    // MARK: - Known Entitlement Keys
    
    /// Sign in with Apple entitlement key.
    public static let signInWithAppleKey = "com.apple.developer.applesignin"
    
    /// HealthKit entitlement key.
    public static let healthKitKey = "com.apple.developer.healthkit"
    
    /// Push notifications entitlement key.
    public static let pushNotificationsKey = "aps-environment"
    
    /// iCloud entitlement key.
    public static let iCloudKey = "com.apple.developer.icloud-container-identifiers"
    
    /// App groups entitlement key.
    public static let appGroupsKey = "com.apple.security.application-groups"
    
    /// Associated domains entitlement key.
    public static let associatedDomainsKey = "com.apple.developer.associated-domains"
    
    /// Background modes entitlement key (different from Info.plist's UIBackgroundModes).
    public static let backgroundModesKey = "com.apple.developer.background-modes"
    
    // MARK: - Parsing
    
    /// Parses an entitlements file at the given URL.
    ///
    /// - Parameter url: Path to the .entitlements file.
    /// - Returns: Dictionary containing the entitlements.
    /// - Throws: `ParseError` if parsing fails.
    public static func parse(at url: URL) throws -> [String: Any] {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw ParseError.fileNotFound(path: url.path)
        }
        
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw ParseError.readError(path: url.path, underlying: error)
        }
        
        return try parse(data: data, path: url.path)
    }
    
    /// Parses entitlements from raw data.
    ///
    /// - Parameters:
    ///   - data: Raw plist data.
    ///   - path: Path for error messages (optional).
    /// - Returns: Dictionary containing the entitlements.
    /// - Throws: `ParseError` if parsing fails.
    public static func parse(data: Data, path: String = "<data>") throws -> [String: Any] {
        do {
            guard let dict = try PropertyListSerialization.propertyList(
                from: data,
                options: [],
                format: nil
            ) as? [String: Any] else {
                throw ParseError.invalidFormat(path: path, reason: "Root is not a dictionary")
            }
            return dict
        } catch let error as ParseError {
            throw error
        } catch {
            throw ParseError.invalidFormat(path: path, reason: error.localizedDescription)
        }
    }
    
    // MARK: - Structured Result
    
    /// Structured representation of parsed entitlements.
    public struct ParsedEntitlements: Sendable {
        /// All entitlement keys present.
        public let allKeys: Set<String>
        
        /// Whether Sign in with Apple is enabled.
        public let hasSignInWithApple: Bool
        
        /// Whether HealthKit is enabled.
        public let hasHealthKit: Bool
        
        /// Whether push notifications are configured.
        public let hasPushNotifications: Bool
        
        /// Whether iCloud is configured.
        public let hasICloud: Bool
        
        /// Whether app groups are configured.
        public let hasAppGroups: Bool
        
        /// App group identifiers (if configured).
        public let appGroups: [String]
        
        /// Associated domains (if configured).
        public let associatedDomains: [String]
        
        /// Raw dictionary for accessing other values.
        public let raw: [String: Any]
        
        /// Creates a ParsedEntitlements from a raw dictionary.
        ///
        /// - Parameter dict: The raw entitlements dictionary.
        public init(from dict: [String: Any]) {
            self.allKeys = Set(dict.keys)
            self.raw = dict
            
            // Sign in with Apple
            if let siwaValue = dict[EntitlementsParser.signInWithAppleKey] {
                if let array = siwaValue as? [String] {
                    self.hasSignInWithApple = array.contains("Default")
                } else {
                    self.hasSignInWithApple = true
                }
            } else {
                self.hasSignInWithApple = false
            }
            
            // HealthKit
            self.hasHealthKit = dict[EntitlementsParser.healthKitKey] != nil
            
            // Push notifications
            self.hasPushNotifications = dict[EntitlementsParser.pushNotificationsKey] != nil
            
            // iCloud
            self.hasICloud = dict[EntitlementsParser.iCloudKey] != nil
            
            // App groups
            if let groups = dict[EntitlementsParser.appGroupsKey] as? [String] {
                self.hasAppGroups = !groups.isEmpty
                self.appGroups = groups
            } else {
                self.hasAppGroups = false
                self.appGroups = []
            }
            
            // Associated domains
            if let domains = dict[EntitlementsParser.associatedDomainsKey] as? [String] {
                self.associatedDomains = domains
            } else {
                self.associatedDomains = []
            }
        }
    }
    
    /// Parses an entitlements file and returns a structured result.
    ///
    /// - Parameter url: Path to the .entitlements file.
    /// - Returns: Structured entitlements data.
    /// - Throws: `ParseError` if parsing fails.
    public static func parseStructured(at url: URL) throws -> ParsedEntitlements {
        let dict = try parse(at: url)
        return ParsedEntitlements(from: dict)
    }
    
    // MARK: - Helper Methods
    
    /// Checks if Sign in with Apple is enabled.
    ///
    /// - Parameter entitlements: The entitlements dictionary.
    /// - Returns: True if SIWA is enabled.
    public static func hasSignInWithApple(_ entitlements: [String: Any]) -> Bool {
        if let siwaValue = entitlements[signInWithAppleKey] {
            if let array = siwaValue as? [String] {
                return array.contains("Default")
            }
            return true
        }
        return false
    }
    
    /// Checks if HealthKit is enabled.
    ///
    /// - Parameter entitlements: The entitlements dictionary.
    /// - Returns: True if HealthKit is enabled.
    public static func hasHealthKit(_ entitlements: [String: Any]) -> Bool {
        entitlements[healthKitKey] != nil
    }
    
    /// Checks if a specific entitlement key exists.
    ///
    /// - Parameters:
    ///   - key: The entitlement key to check.
    ///   - entitlements: The entitlements dictionary.
    /// - Returns: True if the key exists.
    public static func hasEntitlement(_ key: String, in entitlements: [String: Any]) -> Bool {
        entitlements[key] != nil
    }
    
    /// Retrieves an array value for an entitlement key.
    ///
    /// - Parameters:
    ///   - key: The entitlement key.
    ///   - entitlements: The entitlements dictionary.
    /// - Returns: The array value, or nil if not found or not an array.
    public static func arrayValue(for key: String, in entitlements: [String: Any]) -> [String]? {
        entitlements[key] as? [String]
    }
    
    /// Retrieves a string value for an entitlement key.
    ///
    /// - Parameters:
    ///   - key: The entitlement key.
    ///   - entitlements: The entitlements dictionary.
    /// - Returns: The string value, or nil if not found or not a string.
    public static func stringValue(for key: String, in entitlements: [String: Any]) -> String? {
        entitlements[key] as? String
    }
    
    /// Retrieves a boolean value for an entitlement key.
    ///
    /// - Parameters:
    ///   - key: The entitlement key.
    ///   - entitlements: The entitlements dictionary.
    /// - Returns: The boolean value, or nil if not found or not a boolean.
    public static func boolValue(for key: String, in entitlements: [String: Any]) -> Bool? {
        entitlements[key] as? Bool
    }
}
