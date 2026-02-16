---
title: "How to Fix ITMS-91053: The Definitive Guide to iOS Privacy Manifests in 2026"
description: "Complete guide to fixing Apple's ITMS-91053 error. Learn how to create PrivacyInfo.xcprivacy, declare Required Reason APIs, choose correct reason codes, and pass App Store review — especially for AI-generated iOS apps."
pubDate: 2026-02-16
tags: ["Privacy Manifests", "ITMS-91053", "App Store", "iOS", "Xcode"]
author: "ShipLint Team"
readingTime: "10 min read"
canonical: "https://shiplint.app/blog/fix-itms-91053-ios-privacy-manifests-guide/"
featured: true
draft: false
---

If you've ever submitted an iOS app to the App Store and received the dreaded **ITMS-91053** error, you're not alone. Since Apple began enforcing privacy manifests in Spring 2024, this has become one of the most common reasons for App Store rejection — and it's especially prevalent in apps built with AI coding tools like Cursor, GitHub Copilot, and Claude.

This guide covers everything you need to know about ITMS-91053: what triggers it, how to fix it step by step, which reason codes to use, and how to prevent it from happening again.

## What Is ITMS-91053?

**ITMS-91053** is an Apple App Store Connect error that means your app uses one or more **Required Reason APIs** but doesn't include a **privacy manifest file** (`PrivacyInfo.xcprivacy`) declaring why.

Apple introduced this requirement at WWDC 2023 and began enforcing it in **Spring 2024**. The goal is to prevent device fingerprinting — apps that use system APIs like `UserDefaults`, file timestamps, or disk space checks must now declare their legitimate reasons for doing so.

Here's what the error looks like when you upload to App Store Connect:

> ITMS-91053: Missing API declaration - Your app's code in the "[YourApp]" file references one or more APIs that require reasons, including the following API categories: NSPrivacyAccessedAPICategoryUserDefaults. While no action is currently required, starting May 1, 2024, when you upload a new app or app update, you must include a NSPrivacyAccessedAPITypes array in your app's privacy manifest to provide approved reasons for these APIs.

## Why Does This Happen With AI-Generated Code?

If you're building your iOS app with **Cursor, GitHub Copilot, Claude, or ChatGPT**, you're especially likely to hit ITMS-91053. Here's why:

1. **UserDefaults is everywhere.** AI code generators love `UserDefaults.standard` for storing settings, preferences, onboarding state, and cached values. Nearly every AI-generated app uses it.

2. **Privacy manifests are new.** The requirement started in 2024, so most AI training data predates it. The AI simply doesn't know this file needs to exist.

3. **It's not a code issue.** Your Swift compiles fine. Tests pass. The app runs beautifully in the simulator. The missing file is a project-level configuration that AI tools don't manage.

4. **File timestamps are sneaky.** Even simple file operations like checking when a file was created trigger Required Reason API declarations. AI-generated file handling code almost never accounts for this.

This is the fundamental gap between "code that works" and "code that ships to the App Store."

## Required Reason API Categories

Apple classifies five categories of APIs as "Required Reason APIs." If your app or any of its dependencies use any of these, you need a privacy manifest:

### 1. User Defaults (`NSPrivacyAccessedAPICategoryUserDefaults`)

**APIs:** `UserDefaults`, `NSUserDefaults`

This is the most common trigger. If your app calls `UserDefaults.standard.set()` or `UserDefaults.standard.bool(forKey:)` even once — even for a simple boolean flag — you need to declare it.

**Common reason codes:**
- `CA92.1` — Access user defaults to read/write data specific to the app (most common)
- `1C8F.1` — Access user defaults via a container identifier

### 2. File Timestamp (`NSPrivacyAccessedAPICategoryFileTimestamp`)

**APIs:** `NSFileCreationDate`, `NSFileModificationDate`, `creationDate`, `modificationDate`, `contentModificationDate`

Triggered by any code that checks when a file was created or last modified. This includes common operations like sorting files by date or checking if a cache is stale.

**Common reason codes:**
- `C617.1` — Access file timestamps inside the app's container
- `DDA9.1` — Display file timestamps to the user
- `3B52.1` — Access timestamps of files the user explicitly granted access to

### 3. System Boot Time (`NSPrivacyAccessedAPICategorySystemBootTime`)

**APIs:** `systemUptime`, `mach_absolute_time()`

Used for measuring elapsed time. If your app measures performance, tracks animation duration, or implements debouncing with system time, this applies.

**Common reason codes:**
- `35F9.1` — Measure elapsed time between events in the app

### 4. Disk Space (`NSPrivacyAccessedAPICategoryDiskSpace`)

**APIs:** `volumeAvailableCapacity`, `volumeAvailableCapacityForImportantUsage`, `volumeAvailableCapacityForOpportunisticUsage`

Triggered when your app checks available storage — common in apps that download large files, cache media, or record video.

**Common reason codes:**
- `E174.1` — Check if there's enough disk space before writing files
- `85F4.1` — Display disk space information to the user

### 5. Active Keyboards (`NSPrivacyAccessedAPICategoryActiveKeyboards`)

**APIs:** `activeInputModes`

Less common. Only applies if your app reads the list of active keyboard layouts.

**Common reason codes:**
- `54BD.1` — Customize the app's behavior based on active keyboards

## Step-by-Step Fix

### Step 1: Create PrivacyInfo.xcprivacy

In Xcode, go to **File → New → File**, search for **"App Privacy"**, and select the **App Privacy** template. This creates a `PrivacyInfo.xcprivacy` file in your project.

Alternatively, create the file manually. It's a standard property list (XML plist):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- Add your API declarations here -->
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

### Step 2: Identify Which APIs Your App Uses

Before you can declare the right reason codes, you need to know which Required Reason APIs your code (and dependencies) use.

**Manual search:**

```bash
# Search for UserDefaults
grep -r "UserDefaults\|NSUserDefaults" --include="*.swift" .

# Search for file timestamps
grep -r "creationDate\|modificationDate\|NSFileCreationDate\|NSFileModificationDate" --include="*.swift" .

# Search for system uptime
grep -r "systemUptime\|mach_absolute_time" --include="*.swift" .

# Search for disk space
grep -r "volumeAvailableCapacity" --include="*.swift" .
```

**Or use ShipLint** to detect them automatically:

```bash
npx shiplint scan .
```

ShipLint scans your Swift source files for Required Reason API usage and checks whether your privacy manifest declares matching entries.

### Step 3: Add API Declarations

For each API category your app uses, add a `dict` entry to the `NSPrivacyAccessedAPITypes` array. Here's a complete example for a typical app:

```xml
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

  <!-- File Timestamp -->
  <dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
      <string>C617.1</string>
    </array>
  </dict>

  <!-- System Boot Time -->
  <dict>
    <key>NSPrivacyAccessedAPIType</key>
    <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
    <key>NSPrivacyAccessedAPITypeReasons</key>
    <array>
      <string>35F9.1</string>
    </array>
  </dict>
</array>
```

### Step 4: Choose the Right Reason Codes

This is where many developers trip up. You **must** use reason codes that accurately describe your actual usage. Apple's automated system checks that you've declared *a* reason, but human reviewers may verify accuracy.

**Rules of thumb:**

- **UserDefaults for app settings?** → Use `CA92.1`
- **UserDefaults via App Groups/container?** → Use `1C8F.1`
- **File timestamps within your app's sandbox?** → Use `C617.1`
- **Showing file dates to users?** → Use `DDA9.1`
- **Measuring elapsed time?** → Use `35F9.1`
- **Checking storage before download?** → Use `E174.1`

If multiple reasons apply, include all of them in the `NSPrivacyAccessedAPITypeReasons` array. You can declare more than one reason per API category.

### Step 5: Verify Target Membership

This is a subtle gotcha: your `PrivacyInfo.xcprivacy` file must be included in your app target's build. In Xcode, select the file and check the **Target Membership** in the File Inspector (right panel). If it's not included in your main app target, Apple won't see it in the built binary.

### Step 6: Handle Third-Party SDKs

Third-party SDKs that use Required Reason APIs must include their **own** privacy manifest inside their framework bundle. If you're using popular SDKs:

- **Firebase:** Updated in late 2023. Make sure you're on a recent version.
- **Alamofire:** Added privacy manifest in 5.8.1+.
- **Realm:** Added privacy manifest in 10.45.0+.
- **SDWebImage:** Added privacy manifest in 5.18.5+.

Update your dependencies to versions that include `PrivacyInfo.xcprivacy`. If an SDK hasn't added one yet, file an issue on their repository — or consider alternatives.

### Step 7: Rebuild and Resubmit

After making your changes:

1. Clean your build folder: **Product → Clean Build Folder** (⇧⌘K)
2. Archive: **Product → Archive**
3. Upload to App Store Connect
4. The ITMS-91053 error should be gone

## Common Mistakes

### Mistake 1: Forgetting About Dependencies

Your code might not directly use `UserDefaults`, but a CocoaPod, Swift Package, or framework you depend on probably does. You need to ensure those SDKs include their own privacy manifests.

### Mistake 2: Wrong Reason Code

Using `1C8F.1` (container-based access) when your app only uses `UserDefaults.standard` (which should be `CA92.1`). Apple reviewers have flagged this in some cases.

### Mistake 3: File Not in Target

Creating `PrivacyInfo.xcprivacy` but forgetting to add it to your app target's membership. The file exists in your project navigator but isn't included in the actual build.

### Mistake 4: Only Declaring One API

Your app uses UserDefaults *and* file timestamps, but you only declare UserDefaults in the manifest. You need to declare every Required Reason API category your app (not just your code — your entire binary including dependencies) uses.

### Mistake 5: Placing the Manifest in the Wrong Location

For apps, the privacy manifest goes at the root level of your app bundle. For frameworks, it goes inside the framework bundle. Don't put your app's manifest inside a framework target or vice versa.

## Preventing ITMS-91053 in CI/CD

The best way to prevent this error is to catch it before you submit. Add ShipLint to your CI pipeline:

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

ShipLint exits with code 1 if issues are found, making it easy to gate your CI pipeline. Catch privacy manifest issues on every PR instead of discovering them during App Store upload.

## Quick Reference: Complete PrivacyInfo.xcprivacy Template

Here's a copy-paste-ready template that covers the most common Required Reason APIs:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
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

Remove any API categories your app doesn't use, and add any that are missing. The key is accuracy — declare exactly what you use, nothing more, nothing less.

## FAQ

**Do I need a privacy manifest if I only use UserDefaults for one boolean?**

Yes. Any use of `UserDefaults` — even a single `bool(forKey:)` call — requires a privacy manifest entry with reason code `CA92.1`.

**What if my app doesn't use any Required Reason APIs directly?**

Check your dependencies. If any framework, pod, or Swift package you use includes Required Reason APIs, those SDKs need their own privacy manifests. Update to the latest versions.

**Can I have multiple reason codes for one API category?**

Yes. If `UserDefaults` is used for both app functionality (`CA92.1`) and container-based access (`1C8F.1`), include both in the `NSPrivacyAccessedAPITypeReasons` array.

**When did enforcement start?**

Apple began enforcement on **May 1, 2024**. All new app submissions and updates must include privacy manifests for Required Reason APIs.

**What happens if I pick the wrong reason code?**

Automated checks verify that you've declared *a* reason. Human reviewers during App Review may verify that the declared reason matches your actual usage. Pick the most accurate code.

## Further Reading

- [Apple: Privacy Manifest Files](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files)
- [Apple: Describing Use of Required Reason API](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api)
- [Apple: Third-Party SDK Requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- [WWDC 2023: Get Started with Privacy Manifests](https://developer.apple.com/videos/play/wwdc2023/10060/)

---

*ShipLint detects ITMS-91053 automatically by scanning your Swift source for Required Reason API usage and verifying your privacy manifest declarations. Run `npx shiplint scan .` in your project directory to catch this before submitting to App Store Connect.*
