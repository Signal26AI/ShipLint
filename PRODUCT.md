# ReviewShield — Product Brief

**Read this before doing ANY work on ReviewShield.**

---

## What We're Building

A tool that scans iOS projects for App Store rejection risks *before* submission.

## Who It's For

- Indie iOS developers
- Small teams (2-10 devs)
- First-time App Store submitters
- Cross-platform devs (Flutter, React Native) less familiar with Apple's rules

## The Pain We Solve

**App Store review is unpredictable.** Developers feel anxious because:

- Same app gets approved, then rejected, then approved again
- Rejections delay launches by days or weeks
- Vague rejection emails don't explain how to fix
- Stakes are high (revenue, users waiting, boss asking why)

**The emotional truth:** It's not just about technical compliance. It's about *reducing anxiety* and *feeling prepared*.

## What We Do

- Scan source code for common rejection causes
- Tell developers exactly what's wrong and how to fix it
- Run in CI so issues are caught early (not at submit time)
- Give confidence: "You're ready to submit"

## What We DON'T Do

- We don't test the running app (no device farm)
- We don't catch crashes or runtime bugs
- We don't guarantee approval (Apple is unpredictable)
- We don't replace human QA

**We catch config/metadata issues. We don't catch behavioral issues.**

## Our Positioning

"Know before you submit."

Not "guarantee approval" — that's impossible.
Not "automated QA" — that's Rubber Duck.

We're the *fast, cheap, early* check. Run it on every PR.

## Success Metrics

- **Primary:** Monthly Recurring Revenue (MRR)
- **Secondary:** Scans per user (engagement)
- **Tertiary:** Issues caught (value delivered)

## Pricing

- $9/mo per repo, or $29/mo unlimited
- 14-day free trial
- Target: $300 MRR first, then $3,000 MRR

## Competitors

- **Rubber Duck** ($19-99/mo) — human QA + real devices, slower, more thorough
- **Fastlane precheck** — free, but only checks App Store Connect metadata

We're faster and cheaper than Rubber Duck, deeper than Fastlane.

---

*If you're unsure whether a feature fits, ask: "Does this reduce submission anxiety?"*
