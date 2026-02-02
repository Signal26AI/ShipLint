import Foundation

/// Central registry for all available rules.
///
/// `RuleRegistry` maintains the collection of rules available for scanning.
/// It provides methods to register rules, look them up, and filter by various criteria.
///
/// ## Example
///
/// ```swift
/// let registry = RuleRegistry()
/// registry.register(MissingCameraPurposeRule())
/// registry.register(MissingLocationPurposeRule())
///
/// // Get all rules
/// let allRules = registry.allRules()
///
/// // Get rules by category
/// let privacyRules = registry.rules(for: .privacy)
///
/// // Look up specific rule
/// if let rule = registry.rule(withId: "privacy-001-missing-camera-purpose") {
///     print("Found rule: \(rule.name)")
/// }
/// ```
public final class RuleRegistry: @unchecked Sendable {
    
    /// Thread-safe storage for rules.
    private var rules: [Rule] = []
    private let lock = NSLock()
    
    /// Set of disabled rule IDs.
    private var disabledRuleIds: Set<String> = []
    
    /// Creates a new empty registry.
    public init() {}
    
    /// Creates a registry with pre-registered rules.
    ///
    /// - Parameter rules: Array of rules to register.
    public init(rules: [Rule]) {
        self.rules = rules
    }
    
    // MARK: - Registration
    
    /// Registers a rule with the registry.
    ///
    /// - Parameter rule: The rule to register.
    /// - Note: If a rule with the same ID already exists, it will be replaced.
    public func register(_ rule: Rule) {
        lock.lock()
        defer { lock.unlock() }
        
        // Remove existing rule with same ID if present
        rules.removeAll { $0.id == rule.id }
        rules.append(rule)
    }
    
    /// Registers multiple rules at once.
    ///
    /// - Parameter newRules: Array of rules to register.
    public func register(_ newRules: [Rule]) {
        for rule in newRules {
            register(rule)
        }
    }
    
    // MARK: - Retrieval
    
    /// Returns all registered rules.
    public func allRules() -> [Rule] {
        lock.lock()
        defer { lock.unlock() }
        return rules
    }
    
    /// Returns enabled rules (excludes disabled rules).
    public func enabledRules() -> [Rule] {
        lock.lock()
        defer { lock.unlock() }
        return rules.filter { !disabledRuleIds.contains($0.id) }
    }
    
    /// Returns the rule with the given ID, if it exists.
    ///
    /// - Parameter id: The rule ID to look up.
    /// - Returns: The rule, or nil if not found.
    public func rule(withId id: String) -> Rule? {
        lock.lock()
        defer { lock.unlock() }
        return rules.first { $0.id == id }
    }
    
    /// Returns all rules in the given category.
    ///
    /// - Parameter category: The category to filter by.
    /// - Returns: Array of rules in the category.
    public func rules(for category: RuleCategory) -> [Rule] {
        lock.lock()
        defer { lock.unlock() }
        return rules.filter { $0.category == category }
    }
    
    /// Returns all rules with the given severity or higher.
    ///
    /// - Parameter minSeverity: Minimum severity to include.
    /// - Returns: Array of matching rules.
    public func rules(minSeverity: Severity) -> [Rule] {
        lock.lock()
        defer { lock.unlock() }
        return rules.filter { $0.severity >= minSeverity }
    }
    
    /// Returns the number of registered rules.
    public var count: Int {
        lock.lock()
        defer { lock.unlock() }
        return rules.count
    }
    
    // MARK: - Enable/Disable
    
    /// Disables a rule by ID.
    ///
    /// - Parameter id: The rule ID to disable.
    public func disable(_ id: String) {
        lock.lock()
        defer { lock.unlock() }
        disabledRuleIds.insert(id)
    }
    
    /// Enables a previously disabled rule.
    ///
    /// - Parameter id: The rule ID to enable.
    public func enable(_ id: String) {
        lock.lock()
        defer { lock.unlock() }
        disabledRuleIds.remove(id)
    }
    
    /// Checks if a rule is enabled.
    ///
    /// - Parameter id: The rule ID to check.
    /// - Returns: True if the rule is enabled.
    public func isEnabled(_ id: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return !disabledRuleIds.contains(id)
    }
    
    // MARK: - Default Registry
    
    /// Creates a registry with all default rules registered.
    public static var `default`: RuleRegistry {
        let registry = RuleRegistry()
        
        // Privacy rules
        registry.register(MissingCameraPurposeRule())
        registry.register(MissingLocationPurposeRule())
        registry.register(ATTTrackingMismatchRule())
        registry.register(LocationAlwaysUnjustifiedRule())
        
        // Auth rules
        registry.register(ThirdPartyLoginNoSIWARule())
        
        return registry
    }
}
