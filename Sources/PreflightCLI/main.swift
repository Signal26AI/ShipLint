import ArgumentParser
import PreflightCore
import Foundation

/// iOS Preflight CLI - App Store Review Guideline Scanner
@main
struct Preflight: ParsableCommand {
    static let configuration = CommandConfiguration(
        commandName: "preflight",
        abstract: "Scan iOS projects for App Store Review Guideline violations.",
        version: preflightVersion,
        subcommands: [Scan.self],
        defaultSubcommand: Scan.self
    )
}

/// Scan command for analyzing iOS projects.
struct Scan: ParsableCommand {
    static let configuration = CommandConfiguration(
        abstract: "Scan an Xcode project for compliance issues."
    )
    
    @Argument(help: "Path to the Xcode project (.xcodeproj) or workspace (.xcworkspace)")
    var projectPath: String
    
    @Option(name: .shortAndLong, help: "Output format: console, json, or html")
    var format: OutputFormat = .console
    
    @Option(name: .shortAndLong, help: "Output file path (defaults to stdout for console/json)")
    var output: String?
    
    @Option(name: .long, help: "Minimum severity to report: critical, high, medium, low, info")
    var minSeverity: Severity = .low
    
    @Flag(name: .long, help: "Disable colored output")
    var noColor: Bool = false
    
    func run() throws {
        // Resolve project path
        let url = URL(fileURLWithPath: projectPath)
        
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw PreflightError.projectNotFound(path: projectPath)
        }
        
        // For now, just print a placeholder message
        // Full scanner implementation will come in future sprints
        print("iOS Preflight v\(preflightVersion)")
        print("Scanning: \(url.path)")
        print("")
        print("⚠️  Scanner implementation in progress...")
        print("   Core models and first rule (camera purpose string) are ready.")
        print("   Full project parsing coming in Sprint 1.")
    }
}

/// Supported output formats.
enum OutputFormat: String, ExpressibleByArgument, CaseIterable {
    case console
    case json
    case html
}

/// Custom errors for the CLI.
enum PreflightError: LocalizedError {
    case projectNotFound(path: String)
    case invalidProject(path: String, reason: String)
    case scanFailed(reason: String)
    
    var errorDescription: String? {
        switch self {
        case .projectNotFound(let path):
            return "Project not found at: \(path)"
        case .invalidProject(let path, let reason):
            return "Invalid project at \(path): \(reason)"
        case .scanFailed(let reason):
            return "Scan failed: \(reason)"
        }
    }
}

// Extend Severity to work with ArgumentParser
extension Severity: ExpressibleByArgument {}
