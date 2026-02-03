# Agent Instructions — ReviewShield

## Before You Start

1. **Read PRODUCT.md** — Understand what we're building and why
2. **Read the research** — `/root/vault/Signal26/Products/ios-preflight/research/`
3. **Check the roadmap** — `/root/vault/Signal26/Products/ios-preflight/ROADMAP.md`

## Key Principles

**Reduce anxiety, not just errors.** Our users are stressed about rejection. Every feature should help them feel confident.

**Fast and cheap beats thorough.** We're the quick check, not the deep audit. Seconds, not hours.

**Config issues only.** We scan source code. We don't test running apps. Don't scope creep into runtime testing.

## Feature Checklist

**Before proposing ANY feature or rule, answer these:**

- [ ] **Does this reduce submission anxiety?** (If no, reconsider)
- [ ] **Is this a common rejection reason?** (Check Reddit, research)
- [ ] **Can we do this with static analysis?** (No runtime = yes)
- [ ] **Is the fix actionable?** (User knows exactly what to change)
- [ ] **Does it fit our "fast & cheap" positioning?** (Seconds, not hours)

If you can't check all boxes, don't build it.

## Code Standards

- TypeScript, strict mode
- Jest for testing
- Follow existing patterns in `src/rules/`
- Every rule needs tests

## When Adding Rules

Ask: "Is this a common rejection reason?" Check:
- Reddit complaints
- Apple's published guidelines
- Our customer research

Don't add rules for edge cases nobody hits.

## Commit Messages

Use conventional commits:
- `feat:` new features
- `fix:` bug fixes  
- `docs:` documentation
- `chore:` maintenance

## PR Workflow

1. Create feature branch
2. Make changes
3. Push and create PR via `gh pr create`
4. Reviewer agent will review
5. Address feedback
6. Merge when approved
