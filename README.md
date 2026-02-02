# iOS Preflight

A command-line tool that scans iOS app projects for App Store Review Guideline violations before submission.

## Overview

iOS Preflight analyzes your Xcode project to detect common issues that cause App Store rejections:

- Missing privacy usage descriptions (camera, location, etc.)
- ATT tracking mismatches
- Sign in with Apple requirements
- Entitlements configuration issues
- And more...

## Installation

### Build from Source

```bash
git clone https://github.com/signal26/ios-preflight.git
cd ios-preflight
swift build -c release
cp .build/release/preflight /usr/local/bin/
```

## Usage

### Basic Scan

```bash
preflight scan ./MyApp.xcodeproj
```

### JSON Output (for CI)

```bash
preflight scan ./MyApp.xcodeproj --format json --output report.json
```

### HTML Report

```bash
preflight scan ./MyApp.xcodeproj --format html --output report.html
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success, no critical or high findings |
| 1 | Critical or high severity findings present |
| 2 | Error (invalid path, parse failure, etc.) |

## Project Structure

```
ios-preflight/
├── Package.swift
├── Sources/
│   ├── PreflightCore/       # Core analysis library
│   │   ├── Models/          # Data structures
│   │   ├── Parsers/         # Plist, entitlements parsing
│   │   ├── Rules/           # Check implementations
│   │   └── Reports/         # Output formatters
│   └── PreflightCLI/        # CLI interface
├── Tests/
│   └── PreflightCoreTests/
└── README.md
```

## License

MIT License - Copyright (c) 2026 Signal26

## Contributing

Contributions welcome! Please read CONTRIBUTING.md before submitting PRs.
