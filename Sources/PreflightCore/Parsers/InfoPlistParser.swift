import Foundation

/// Parser for Info.plist files.
///
/// `InfoPlistParser` reads and parses Info.plist files, providing access
/// to bundle identifiers, display names, usage descriptions, and other
/// app configuration values.
///
/// ## Example
///
/// ```swift
/// let plistData = try InfoPlistParser.parse(at: plistURL)
/// let bundleId = plistData["CFBundleIdentifier"] as? String
/// let usageDescriptions = InfoPlistParser.extractUsageDescriptions(from: plistData)
/// ```
public enum InfoPlistParser {
    
    // MARK: - Errors
    
    /// Errors that can occur during parsing.
    public enum ParseError: LocalizedError {
        case fileNotFound(path: String)
        case invalidFormat(path: String, reason: String)
        case readError(path: String, underlying: Error)
        
        public var errorDescription: String? {
            switch self {
            case .fileNotFound(let path):
                return "Info.plist not found at: \(path)"
            case .invalidFormat(let path, let reason):
                return "Invalid Info.plist format at \(path): \(reason)"
            case .readError(let path, let underlying):
                return "Error reading Info.plist at \(path): \(underlying.localizedDescription)"
            }
        }
    }
    
    // MARK: - Parsing
    
    /// Parses an Info.plist file at the given URL.
    ///
    /// - Parameter url: Path to the Info.plist file.
    /// - Returns: Dictionary containing the plist contents.
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
    
    /// Parses Info.plist from raw data.
    ///
    /// - Parameters:
    ///   - data: Raw plist data.
    ///   - path: Path for error messages (optional).
    /// - Returns: Dictionary containing the plist contents.
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
    
    // MARK: - Extraction Helpers
    
    /// Result of parsing an Info.plist file.
    public struct ParsedInfoPlist: Sendable {
        /// Bundle identifier (CFBundleIdentifier).
        public let bundleIdentifier: String?
        
        /// Display name (CFBundleDisplayName or CFBundleName).
        public let displayName: String?
        
        /// Bundle name (CFBundleName).
        public let bundleName: String?
        
        /// All keys present in the plist.
        public let allKeys: Set<String>
        
        /// All NS*UsageDescription keys and their values.
        public let usageDescriptions: [String: String]
        
        /// Minimum iOS version (MinimumOSVersion).
        public let minimumOSVersion: String?
        
        /// Required device capabilities (UIRequiredDeviceCapabilities).
        public let requiredDeviceCapabilities: [String]
        
        /// Background modes (UIBackgroundModes).
        public let backgroundModes: [String]
        
        /// Raw dictionary for accessing other values.
        public let raw: [String: Any]
        
        /// Creates a ParsedInfoPlist from a raw dictionary.
        ///
        /// - Parameter dict: The raw plist dictionary.
        public init(from dict: [String: Any]) {
            self.bundleIdentifier = dict["CFBundleIdentifier"] as? String
            self.displayName = (dict["CFBundleDisplayName"] as? String) ?? (dict["CFBundleName"] as? String)
            self.bundleName = dict["CFBundleName"] as? String
            self.allKeys = Set(dict.keys)
            self.minimumOSVersion = dict["MinimumOSVersion"] as? String
            self.requiredDeviceCapabilities = (dict["UIRequiredDeviceCapabilities"] as? [String]) ?? []
            self.backgroundModes = (dict["UIBackgroundModes"] as? [String]) ?? []
            self.raw = dict
            
            // Extract usage descriptions
            var descriptions: [String: String] = [:]
            for (key, value) in dict {
                if key.hasPrefix("NS") && key.hasSuffix("UsageDescription") {
                    if let stringValue = value as? String {
                        descriptions[key] = stringValue
                    }
                }
            }
            self.usageDescriptions = descriptions
        }
    }
    
    /// Parses an Info.plist file and returns a structured result.
    ///
    /// - Parameter url: Path to the Info.plist file.
    /// - Returns: Structured plist data.
    /// - Throws: `ParseError` if parsing fails.
    public static func parseStructured(at url: URL) throws -> ParsedInfoPlist {
        let dict = try parse(at: url)
        return ParsedInfoPlist(from: dict)
    }
    
    /// Extracts all NS*UsageDescription keys and values from a plist dictionary.
    ///
    /// - Parameter dict: The plist dictionary.
    /// - Returns: Dictionary mapping usage description keys to their values.
    public static func extractUsageDescriptions(from dict: [String: Any]) -> [String: String] {
        var descriptions: [String: String] = [:]
        for (key, value) in dict {
            if key.hasPrefix("NS") && key.hasSuffix("UsageDescription") {
                if let stringValue = value as? String {
                    descriptions[key] = stringValue
                }
            }
        }
        return descriptions
    }
    
    /// Known NS*UsageDescription keys and their associated frameworks/APIs.
    public static let knownUsageDescriptionKeys: [String: [String]] = [
        "NSCameraUsageDescription": ["AVFoundation", "UIImagePickerController"],
        "NSMicrophoneUsageDescription": ["AVFoundation", "AVAudioSession"],
        "NSPhotoLibraryUsageDescription": ["PhotosUI", "Photos", "UIImagePickerController"],
        "NSPhotoLibraryAddUsageDescription": ["PhotosUI", "Photos"],
        "NSLocationWhenInUseUsageDescription": ["CoreLocation"],
        "NSLocationAlwaysUsageDescription": ["CoreLocation"],
        "NSLocationAlwaysAndWhenInUseUsageDescription": ["CoreLocation"],
        "NSContactsUsageDescription": ["Contacts", "ContactsUI"],
        "NSCalendarsUsageDescription": ["EventKit", "EventKitUI"],
        "NSRemindersUsageDescription": ["EventKit"],
        "NSBluetoothAlwaysUsageDescription": ["CoreBluetooth"],
        "NSBluetoothPeripheralUsageDescription": ["CoreBluetooth"],
        "NSHealthShareUsageDescription": ["HealthKit"],
        "NSHealthUpdateUsageDescription": ["HealthKit"],
        "NSMotionUsageDescription": ["CoreMotion"],
        "NSSpeechRecognitionUsageDescription": ["Speech"],
        "NSFaceIDUsageDescription": ["LocalAuthentication"],
        "NSHomeKitUsageDescription": ["HomeKit"],
        "NSSiriUsageDescription": ["Intents"],
        "NSAppleMusicUsageDescription": ["MediaPlayer", "StoreKit"],
        "NSUserTrackingUsageDescription": ["AppTrackingTransparency"],
    ]
    
    /// Checks if a usage description value appears to be a placeholder.
    ///
    /// - Parameter value: The usage description text.
    /// - Returns: True if the value appears to be a placeholder.
    public static func isPlaceholder(_ value: String) -> Bool {
        let lowercased = value.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Empty or very short
        if lowercased.count < 10 {
            return true
        }
        
        // Common placeholder patterns
        let placeholders = [
            "lorem ipsum",
            "todo",
            "fixme",
            "placeholder",
            "description here",
            "add description",
            "your app",
            "this app",
            "test",
            "testing",
            "xxx",
            "..."
        ]
        
        return placeholders.contains { lowercased.contains($0) }
    }
}
