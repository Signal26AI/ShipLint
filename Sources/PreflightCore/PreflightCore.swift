/// iOS Preflight - App Store Review Guideline Scanner
///
/// PreflightCore is the core analysis library for iOS Preflight.
/// It provides the scanning engine, rule system, and parsers for
/// detecting App Store Review Guideline violations.
///
/// ## Overview
///
/// The library is organized into several components:
/// - **Models**: Core data types (Finding, ScanContext, ScanResult)
/// - **Parsers**: File parsers (Info.plist, entitlements)
/// - **Rules**: Individual check implementations
/// - **Reports**: Output formatters (Console, JSON, HTML)
///
/// ## Quick Start
///
/// ```swift
/// let scanner = Scanner(registry: RuleRegistry.default)
/// let result = try await scanner.scan(projectPath: URL(fileURLWithPath: "./MyApp.xcodeproj"))
/// print("Found \(result.findings.count) issues")
/// ```

/// The current version of PreflightCore.
public let preflightVersion = "0.1.0"
