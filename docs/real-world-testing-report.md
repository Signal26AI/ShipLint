# ShipLint Real-World Testing Report

**Date:** 2026-02-05  
**Tester:** Cole (Senior Dev)  
**ShipLint Version:** 1.0.0

## Executive Summary

ShipLint was tested against 5 popular open-source projects. The tool performs well overall: it's fast, stable, and catches real issues. **One false positive was identified** that should be fixed before promotion. The tool is **nearly ready** for real users pending the fix below.

---

## Test Summary

| Project | Swift Files | Findings | Scan Time | Errors |
|---------|-------------|----------|-----------|--------|
| Wikipedia iOS | 1,135 | 2 | 554ms | None |
| Mastodon iOS | 877 | 2 | 118ms | None |
| Signal iOS | 2,527 | 1 | 716ms | None |
| Kickstarter iOS | 1,929 | 2 | 409ms | None |
| IINA (macOS) | 184 | 5 | 294ms | None |

**Total:** 6,652 Swift files scanned across 5 projects  
**Average scan time:** ~420ms  
**Crashes/errors:** 0

---

## Notable Findings (Real Issues Caught) ✅

### 1. Wikipedia iOS - Location Permission Misconfiguration

ShipLint correctly identified **two real issues** with Wikipedia's location setup:

- **Missing `NSLocationAlwaysAndWhenInUseUsageDescription`**: Wikipedia has both `NSLocationAlwaysUsageDescription` and `NSLocationWhenInUseUsageDescription`, but is missing the required `NSLocationAlwaysAndWhenInUseUsageDescription` key (required since iOS 11).

- **Always permission without background location capability**: Wikipedia requests Always location but `UIBackgroundModes` only includes `fetch` and `processing` — not `location`. This configuration mismatch would likely draw Apple's attention.

**Verdict:** Both findings are legitimate and would help prevent App Store rejection.

### 2. Kickstarter iOS - ATT Framework Detection

ShipLint correctly flagged that Kickstarter has `NSUserTrackingUsageDescription` but the `AppTrackingTransparency` framework doesn't appear linked. This could indicate an incomplete ATT implementation.

**Verdict:** Valid finding. The medium confidence is appropriate since this could be handled by a wrapper SDK.

### 3. ATS Exception Detection

ShipLint found HTTP exceptions across multiple projects:
- `signal.org` in Signal
- `onion` domains in Mastodon  
- `ksr.test` in Kickstarter (dev domain)
- `assrt.net` in IINA

**Verdict:** Correctly flagged. These are generally intentional but good to surface for review.

---

## False Positive Found 🐛

### Mastodon iOS - Camera Usage Description

**Finding:** "App links against VisionKit but missing NSCameraUsageDescription"

**Reality:** Mastodon uses VisionKit's `ImageAnalyzer` class for Live Text recognition on existing images — this does **not** require camera access. Only `DataScannerViewController` and `VNDocumentCameraViewController` require camera permission.

**Recommendation:** Update `privacy-001-missing-camera-purpose` rule to check for actual camera-requiring classes:
- `DataScannerViewController` → requires camera
- `VNDocumentCameraViewController` → requires camera  
- `ImageAnalyzer` → does NOT require camera (analyzes existing images)

**Severity:** Medium — this would cause confusion for apps using Live Text features.

---

## Platform Detection Gap 📱

IINA is a **macOS** app, not iOS. ShipLint flagged several iOS-specific issues:
- Missing `UILaunchStoryboardName` (iOS-only requirement)
- Missing `UISupportedInterfaceOrientations` (iOS-only)

**Recommendation:** Either:
1. Detect platform from Xcode project and skip iOS-only rules for macOS
2. Add a `--platform` flag to specify target platform
3. Document that ShipLint is iOS-only

**Severity:** Low — tool works but provides irrelevant findings for macOS projects.

---

## Ideas for New Rules

Based on patterns observed:

1. **Background modes consistency** — Check that capabilities match background modes (e.g., if you have push notification entitlement, should you have `remote-notification` background mode?)

2. **Privacy manifest validation** — Upcoming iOS 17.5 requirement. Check for `PrivacyInfo.xcprivacy` file and validate required API declarations.

3. **Test/Debug code detection** — Kickstarter's `ksr.test` ATS exception is clearly for development. Could flag potential dev-only configurations that might slip into release builds.

4. **Minimum deployment target checks** — Flag deprecated APIs based on deployment target.

---

## Performance Assessment

| Metric | Result |
|--------|--------|
| Speed | Excellent (~400ms for 1000+ files) |
| Memory | Not measured, no issues observed |
| Stability | Perfect (0 crashes across 5 projects) |
| Exit codes | Correct (1 = findings, 0 = clean) |

The tool scales well to large codebases (Signal: 2,500+ Swift files in 716ms).

---

## Overall Assessment

| Criteria | Rating | Notes |
|----------|--------|-------|
| Accuracy | ⭐⭐⭐⭐ | One false positive found |
| Coverage | ⭐⭐⭐⭐ | Good rule set, room to grow |
| Performance | ⭐⭐⭐⭐⭐ | Excellent speed |
| Stability | ⭐⭐⭐⭐⭐ | No crashes |
| Output quality | ⭐⭐⭐⭐⭐ | Clear, actionable, well-documented |

### Ready for Promotion?

**Almost.** Fix the VisionKit false positive first:

1. **Blocking:** Update VisionKit detection to check for camera-requiring classes specifically
2. **Nice to have:** Add platform detection or document iOS-only scope

After the VisionKit fix, ShipLint is ready for real users. The tool catches real issues, runs fast, and provides excellent guidance.

---

## Raw Data

Test results saved to:
- `/tmp/test-projects/wikipedia-ios-results.json`
- `/tmp/test-projects/mastodon-ios-results.json`  
- `/tmp/test-projects/signal-ios-results.json`
- `/tmp/test-projects/kickstarter-ios-results.json`
- `/tmp/test-projects/iina-results.json`
