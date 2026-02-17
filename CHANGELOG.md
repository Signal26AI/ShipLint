# Changelog

All notable changes to ShipLint will be documented in this file.

## [1.6.0] - 2026-02-17

### Fixed
- Source scanner now ignores commented-out code (`//` and `/* */` blocks)
- Removed redundant "Fix errors before submitting" action hint from CLI output
- AVFoundation-only camera findings downgraded to High/Medium confidence (matches microphone rule)
- Camera-specific frameworks (AVKit) correctly remain Critical/High

### Changed
- CLI output redesign: Rust-style diagnostics, severity-grouped findings, compact header
- Default mode: icon + title + one-line explanation (terminal-width-aware)
- Verbose mode: full descriptions, boxed fix guidance with wrapping, docs URLs
- Summary shows separate error/warning counts
- Red for Critical (errors), yellow for Warnings

## [1.5.0] - 2026-02-06

### Changed
- Severity semantics: Critical = guaranteed App Store rejection only
- Microphone rule: AVFoundation-only downgraded to High/Medium confidence
- Location-always-unjustified downgraded to High
- CLI redesign v1: severity grouping, Xcode formatter

## [1.4.0] - 2026-02-06

### Added
- MCP support: `shiplint mcp` command with scan, rules, and explain tools
- Competitive positioning updates

## [1.0.0] - 2026-02-05

### Added
- **5 new rules** (15 total):
  - `config-002-missing-encryption-flag` — Missing `ITSAppUsesNonExemptEncryption` key
  - `privacy-008-missing-bluetooth-purpose` — Missing `NSBluetoothAlwaysUsageDescription`
  - `privacy-009-missing-face-id-purpose` — Missing `NSFaceIDUsageDescription`
  - `config-003-missing-launch-storyboard` — Missing `UILaunchStoryboardName`
  - `metadata-002-missing-supported-orientations` — Missing `UISupportedInterfaceOrientations`
- CI workflow with GitHub Actions (Node 18/20/22)
- Error code reference pages (`/errors/itms-*.html`)
- `llms.txt` for AI discoverability

### Changed
- GEO-optimized README with Apple citations, statistics, and FAQ
- Landing page rewrite targeting vibe coders / AI-assisted developers
- Updated positioning: "Your AI writes the code. ShipLint makes sure Apple accepts it."

## [0.1.1] - 2026-02-04

### Fixed
- Replaced all "ReviewShield" references with "ShipLint"

## [0.1.0] - 2026-02-03

### Added
- Initial release with 10 rules
- Privacy rules: camera, location, microphone, photo library, contacts, ATT, location-always
- Auth rules: third-party login without Sign in with Apple
- Metadata rules: missing privacy manifest
- Config rules: ATS exception without justification
- CLI with text, JSON, and SARIF output formats
- GitHub Action support
