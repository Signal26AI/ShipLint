# Changelog

All notable changes to ShipLint will be documented in this file.

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
