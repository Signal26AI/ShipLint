import Foundation

/// Context containing all parsed data for rule evaluation.
///
/// `ScanContext` holds the project information and parsed data that rules
/// evaluate against. It uses lazy loading to only parse what's needed.
///
/// ## Example
///
/// ```swift
/// let context = ScanContext(projectPath: URL(fileURLWithPath: "./MyApp.xcodeproj"))
/// 
/// // Access Info.plist data
/// if let bundleId = context.plistString(for: "CFBundleIdentifier") {
///     print("Bundle ID: \(bundleId)")
/// }
/// 
/// // Check for linked frameworks
/// if context.hasFramework("AVFoundation") {
///     print("Uses camera/audio")
/// }
/// ```
public final class ScanContext: @unchecked Sendable {
    
    // MARK: - Properties
    
    /// Path to the Xcode project or workspace.
    public let projectPath: URL
    
    /// Path to the Info.plist file (if found).
    public private(set) var infoPlistPath: URL?
    
    /// Path to the entitlements file (if found).
    public private(set) var entitlementsPath: URL?
    
    // MARK: - Cached Data
    
    private var _infoPlist: [String: Any]?
    private var _infoPlistLoaded = false
    
    private var _entitlements: [String: Any]?
    private var _entitlementsLoaded = false
    
    private var _linkedFrameworks: Set<String>?
    private var _dependencies: [Dependency]?
    
    // MARK: - Initialization
    
    /// Creates a new scan context for the given project path.
    ///
    /// - Parameter projectPath: Path to the Xcode project or workspace.
    public init(projectPath: URL) {
        self.projectPath = projectPath
    }
    
    /// Creates a scan context with pre-loaded data (for testing).
    ///
    /// - Parameters:
    ///   - projectPath: Path to the project (can be mock path).
    ///   - infoPlist: Pre-loaded Info.plist dictionary.
    ///   - entitlements: Pre-loaded entitlements dictionary.
    ///   - linkedFrameworks: Set of linked framework names.
    ///   - dependencies: List of third-party dependencies.
    public init(
        projectPath: URL,
        infoPlist: [String: Any]?,
        entitlements: [String: Any]? = nil,
        linkedFrameworks: Set<String>? = nil,
        dependencies: [Dependency]? = nil
    ) {
        self.projectPath = projectPath
        self._infoPlist = infoPlist
        self._infoPlistLoaded = true
        self._entitlements = entitlements
        self._entitlementsLoaded = true
        self._linkedFrameworks = linkedFrameworks
        self._dependencies = dependencies
    }
    
    // MARK: - Info.plist Access
    
    /// The parsed Info.plist dictionary.
    public var infoPlist: [String: Any] {
        if !_infoPlistLoaded {
            loadInfoPlist()
        }
        return _infoPlist ?? [:]
    }
    
    /// Sets the Info.plist path for lazy loading.
    ///
    /// - Parameter path: Path to the Info.plist file.
    public func setInfoPlistPath(_ path: URL) {
        self.infoPlistPath = path
        self._infoPlistLoaded = false
        self._infoPlist = nil
    }
    
    /// Retrieves a string value from Info.plist.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The string value, or nil if not found or not a string.
    public func plistString(for key: String) -> String? {
        infoPlist[key] as? String
    }
    
    /// Retrieves an array value from Info.plist.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The array value, or nil if not found or not an array.
    public func plistArray(for key: String) -> [Any]? {
        infoPlist[key] as? [Any]
    }
    
    /// Retrieves a boolean value from Info.plist.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The boolean value, or nil if not found or not a boolean.
    public func plistBool(for key: String) -> Bool? {
        infoPlist[key] as? Bool
    }
    
    /// Checks if a key exists in Info.plist.
    ///
    /// - Parameter key: The key to check.
    /// - Returns: True if the key exists.
    public func hasPlistKey(_ key: String) -> Bool {
        infoPlist[key] != nil
    }
    
    /// Returns all keys in Info.plist.
    public var plistKeys: Set<String> {
        Set(infoPlist.keys)
    }
    
    /// Returns all NS*UsageDescription keys and their values.
    public var usageDescriptions: [String: String] {
        var descriptions: [String: String] = [:]
        for (key, value) in infoPlist {
            if key.hasPrefix("NS") && key.hasSuffix("UsageDescription") {
                if let stringValue = value as? String {
                    descriptions[key] = stringValue
                }
            }
        }
        return descriptions
    }
    
    // MARK: - Entitlements Access
    
    /// The parsed entitlements dictionary.
    public var entitlements: [String: Any] {
        if !_entitlementsLoaded {
            loadEntitlements()
        }
        return _entitlements ?? [:]
    }
    
    /// Sets the entitlements path for lazy loading.
    ///
    /// - Parameter path: Path to the entitlements file.
    public func setEntitlementsPath(_ path: URL) {
        self.entitlementsPath = path
        self._entitlementsLoaded = false
        self._entitlements = nil
    }
    
    /// Checks if an entitlement exists.
    ///
    /// - Parameter key: The entitlement key to check.
    /// - Returns: True if the entitlement exists.
    public func hasEntitlement(_ key: String) -> Bool {
        entitlements[key] != nil
    }
    
    /// Retrieves a string value from entitlements.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The string value, or nil if not found or not a string.
    public func entitlementString(for key: String) -> String? {
        entitlements[key] as? String
    }
    
    /// Retrieves an array value from entitlements.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The array value, or nil if not found or not an array.
    public func entitlementArray(for key: String) -> [Any]? {
        entitlements[key] as? [Any]
    }
    
    /// Retrieves a boolean value from entitlements.
    ///
    /// - Parameter key: The key to look up.
    /// - Returns: The boolean value, or nil if not found or not a boolean.
    public func entitlementBool(for key: String) -> Bool? {
        entitlements[key] as? Bool
    }
    
    /// Checks if Sign in with Apple capability is enabled.
    public var hasSignInWithApple: Bool {
        if let siwaValue = entitlements[EntitlementsParser.signInWithAppleKey] {
            if let array = siwaValue as? [String] {
                return array.contains("Default")
            }
            return true
        }
        return false
    }
    
    // MARK: - Framework Access
    
    /// Set of linked frameworks.
    public var linkedFrameworks: Set<String> {
        _linkedFrameworks ?? []
    }
    
    /// Sets the linked frameworks.
    ///
    /// - Parameter frameworks: Set of framework names.
    public func setLinkedFrameworks(_ frameworks: Set<String>) {
        _linkedFrameworks = frameworks
    }
    
    /// Checks if a framework is linked.
    ///
    /// - Parameter name: The framework name (without .framework extension).
    /// - Returns: True if the framework is linked.
    public func hasFramework(_ name: String) -> Bool {
        linkedFrameworks.contains(name)
    }
    
    // MARK: - Dependencies Access
    
    /// List of third-party dependencies.
    public var dependencies: [Dependency] {
        _dependencies ?? []
    }
    
    /// Sets the dependencies.
    ///
    /// - Parameter deps: List of dependencies.
    public func setDependencies(_ deps: [Dependency]) {
        _dependencies = deps
    }
    
    /// Checks if a dependency matching the pattern exists.
    ///
    /// - Parameter pattern: Substring to match against dependency names.
    /// - Returns: True if a matching dependency exists.
    public func hasDependency(matching pattern: String) -> Bool {
        dependencies.contains { $0.name.localizedCaseInsensitiveContains(pattern) }
    }
    
    // MARK: - Private Methods
    
    private func loadInfoPlist() {
        guard let path = infoPlistPath else {
            _infoPlistLoaded = true
            return
        }
        
        do {
            _infoPlist = try InfoPlistParser.parse(at: path)
        } catch {
            // Log error but don't fail - rules will handle missing data
            _infoPlist = nil
        }
        _infoPlistLoaded = true
    }
    
    private func loadEntitlements() {
        guard let path = entitlementsPath else {
            _entitlementsLoaded = true
            return
        }
        
        do {
            let data = try Data(contentsOf: path)
            _entitlements = try PropertyListSerialization.propertyList(
                from: data,
                options: [],
                format: nil
            ) as? [String: Any]
        } catch {
            _entitlements = nil
        }
        _entitlementsLoaded = true
    }
}

/// A third-party dependency.
public struct Dependency: Codable, Sendable, Equatable {
    /// Name of the dependency (e.g., "Alamofire").
    public let name: String
    
    /// Version string (e.g., "5.6.4").
    public let version: String?
    
    /// Source of the dependency (CocoaPods, SPM, etc.).
    public let source: DependencySource
    
    public init(name: String, version: String? = nil, source: DependencySource) {
        self.name = name
        self.version = version
        self.source = source
    }
}

/// Source of a dependency.
public enum DependencySource: String, Codable, Sendable {
    case cocoapods
    case spm
    case carthage
    case manual
}
