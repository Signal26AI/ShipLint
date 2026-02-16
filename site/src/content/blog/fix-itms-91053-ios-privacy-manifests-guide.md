---
title: "How to Fix ITMS-91053: iOS Privacy Manifests Guide (2026)"
description: "Got ITMS-91053 when uploading to the App Store? Here's how to fix it. Create a PrivacyInfo.xcprivacy file, pick the right reason codes, and stop getting rejected."
pubDate: 2026-02-16
tags: ["Privacy Manifests", "ITMS-91053", "App Store", "iOS", "Xcode"]
author: "ShipLint Team"
readingTime: "5 min read"
canonical: "https://shiplint.app/blog/fix-itms-91053-ios-privacy-manifests-guide/"
featured: true
draft: false
---

**TL;DR:** ITMS-91053 means your app uses certain Apple APIs without declaring *why* in a privacy manifest. The fix: add a `PrivacyInfo.xcprivacy` file to your project with the right reason codes. Takes about 5 minutes. [Jump to the fix](#step-by-step-fix) if you just want the solution.

## What's ITMS-91053?

Apple requires apps to declare why they use specific system APIs (like `UserDefaults`, file timestamps, and disk space checks). If you don't include a `PrivacyInfo.xcprivacy` file explaining your usage, your upload gets rejected with ITMS-91053.

This has been enforced since May 2024, and it's now the single most common privacy-related rejection reason.

The error looks something like this:

> ITMS-91053: Missing API declaration - Your app's code in "[YourApp]" references one or more APIs that require reasons, including the following API categories: NSPrivacyAccessedAPICategoryUserDefaults.

## Why AI-generated apps get hit especially hard

If you're building with Cursor, Copilot, or Claude, you're almost guaranteed to run into this. Here's why:

**AI loves `UserDefaults`.** Every AI-generated iOS app uses it for storing settings, preferences, and state. It's the go-to for simple persistence.

**Privacy manifests are too new.** The requirement started in 2024, but most AI training data is older. Your AI assistant doesn't know this file needs to exist.

**Your code compiles fine.** That's what makes it frustrating. Tests pass, the simulator works great, everything looks good. Then you upload and get rejected for a missing config file that has nothing to do with your code.

## The five API categories Apple cares about

You need a privacy manifest entry for each of these your app uses:

| Category | Common trigger | Most-used reason code |
|----------|---------------|----------------------|
| **UserDefaults** | `UserDefaults.standard.set()` | `CA92.1` (app functionality) |
| **File Timestamps** | `creationDate`, `modificationDate` | `C617.1` (files in app container) |
| **System Boot Time** | `systemUptime`, `mach_absolute_time()` | `35F9.1` (measuring elapsed time) |
| **Disk Space** | `volumeAvailableCapacity` | `E174.1` (checking before writing) |
| **Active Keyboards** | `activeInputModes` | `54BD.1` (customizing behavior) |

Most apps only need UserDefaults and maybe File Timestamps. Don't declare categories you don't use.

## Step-by-step fix

### 1. Create the privacy manifest file

**In Xcode:** File > New > File, search "App Privacy." Xcode gives you a plist editor with dropdowns. Add your API categories and reason codes through the GUI. No XML needed.

**Without Xcode** (or if you prefer editing the file directly), create `PrivacyInfo.xcprivacy` with this XML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- UserDefaults -->
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
</dict>
</plist>
```

Add more `<dict>` entries for each API category your app uses. See the table above for reason codes.

### 2. Find which APIs your app actually uses

Quick grep:

```bash
grep -r "UserDefaults\|NSUserDefaults" --include="*.swift" .
grep -r "creationDate\|modificationDate" --include="*.swift" .
grep -r "systemUptime\|mach_absolute_time" --include="*.swift" .
grep -r "volumeAvailableCapacity" --include="*.swift" .
```

Or just run [ShipLint](https://shiplint.app) and let it tell you:

```bash
npx shiplint scan .
```

### 3. Make sure the file is in your target

This one bites people. Select `PrivacyInfo.xcprivacy` in Xcode, open the File Inspector (right panel), and confirm it's checked under **Target Membership** for your app target. If it's not in the build, Apple won't see it.

### 4. Update your dependencies

Your code might be clean, but your dependencies probably use `UserDefaults` too. Third-party SDKs need their *own* privacy manifest inside their framework bundle.

Most popular SDKs have already added them:
- **Firebase**: Updated late 2023
- **Alamofire**: v5.8.1+
- **Realm**: v10.45.0+
- **SDWebImage**: v5.18.5+

If you're on older versions, update. If an SDK hasn't added a manifest yet, file an issue.

### 5. Clean, archive, resubmit

Clean your build folder (⇧⌘K), archive again, and upload. The error should be gone.

## Mistakes that will waste your time

**Forgetting dependencies.** You grep your code, find nothing, add a manifest anyway "just in case." But your CocoaPod uses `UserDefaults` internally and *that* SDK doesn't have its own manifest. Update your packages.

**Wrong reason code.** Using `1C8F.1` (container access) when you just use `UserDefaults.standard` (that's `CA92.1`). Apple reviewers have flagged this.

**Only declaring one category.** Your app uses UserDefaults *and* file timestamps, but you only declared UserDefaults. Declare everything.

**Manifest not in the build.** The file exists in your project navigator but isn't actually included in the target. Check Target Membership.

## Catch it before you upload

Add ShipLint to your CI so this never happens again:

```yaml
# .github/workflows/shiplint.yml
name: ShipLint
on: [push, pull_request]
jobs:
  lint:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx shiplint scan .
```

ShipLint exits with code 1 if it finds issues. Gate your pipeline on it and catch privacy manifest problems on every PR, not during App Store upload.

## Further reading

- [Apple: Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- [Apple: Describing Use of Required Reason API](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api)
- [WWDC 2023: Get Started with Privacy Manifests](https://developer.apple.com/videos/play/wwdc2023/10060/)
