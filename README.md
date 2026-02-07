# ShipLint

🛡️ **Pre-submission linter for iOS apps.** Catches App Store rejection reasons before you upload.

[![CI](https://github.com/Signal26AI/ShipLint/actions/workflows/ci.yml/badge.svg)](https://github.com/Signal26AI/ShipLint/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/shiplint.svg)](https://www.npmjs.com/package/shiplint)

## What It Does

ShipLint scans your iOS project files — `Info.plist`, entitlements, `PrivacyInfo.xcprivacy`, and `project.pbxproj` — for issues that would trigger ITMS errors (ITMS-90683, ITMS-91053, ITMS-90078) or App Review violations. It runs in under 2 seconds, no Xcode required.

```bash
npx shiplint scan ./YourApp
```

**15 rules** covering privacy usage descriptions, App Tracking Transparency, Sign in with Apple, App Transport Security, privacy manifests, export compliance, and launch configuration.

## Quick Start

```bash
# Run directly (no install)
npx shiplint scan ./MyApp

# Or install globally
npm install -g shiplint
shiplint scan ./MyApp

# Use with AI agents (MCP)
claude mcp add shiplint -- npx shiplint mcp
```

## Documentation

📖 **Full docs:** [`typescript/README.md`](./typescript/README.md)

Includes:
- All 15 rules with Apple guideline references
- MCP setup (Claude Code, Cursor, Xcode 26.3)
- CI/CD integration (GitHub Actions, Xcode Cloud)
- FAQ and comparisons

## Repository Structure

```
ShipLint/
├── typescript/          # CLI & scanning engine (npm package)
│   ├── src/
│   │   ├── cli/         # CLI + MCP server
│   │   ├── rules/       # 15 rule definitions
│   │   ├── formatters/  # text, json, sarif output
│   │   └── ...
│   ├── tests/           # 251 tests
│   └── README.md        # Full documentation
│
├── analytics/           # Usage dashboard (Cloudflare Worker)
│   ├── worker.js        # Stats API + public dashboard
│   ├── schema.sql       # D1 (SQLite) schema
│   └── README.md        # Deployment instructions
│
├── landing/             # Marketing site (shiplint.app)
│   ├── index.html
│   └── errors/          # Error code reference pages
│
├── action/              # GitHub Action (coming soon)
│
└── .github/workflows/   # CI pipeline
```

## Analytics

ShipLint includes optional, anonymous telemetry to track aggregate usage. **No personal data or project info is collected.** The analytics backend is fully open source in `analytics/`.

- View public stats: [shiplint.app/stats](https://shiplint.app/stats)
- Opt-out: `SHIPLINT_NO_TELEMETRY=1`

## Links

- 🌐 [shiplint.app](https://shiplint.app) — Landing page
- 📊 [shiplint.app/stats](https://shiplint.app/stats) — Usage stats
- 📦 [npm: shiplint](https://www.npmjs.com/package/shiplint)
- 💻 [GitHub](https://github.com/Signal26AI/ShipLint)
- 🐛 [Issues](https://github.com/Signal26AI/ShipLint/issues)

## Contributing

Found a missing rule? An ITMS error you keep hitting? [Open an issue](https://github.com/Signal26AI/ShipLint/issues) — we add rules based on real-world rejection patterns.

## License

MIT © 2025–2026 [Signal26](https://signal26.ai)
