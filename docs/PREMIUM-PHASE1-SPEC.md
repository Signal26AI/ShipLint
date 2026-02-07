# ShipLint Premium — Phase 1 Spec

**Goal:** Launch Solo tier ($9/mo) with GitHub App that adds PR inline comments.

**Success metric:** First paying customer.

---

## What We're Building

A GitHub App that:
1. Installs on user's repos
2. Runs ShipLint on every PR
3. Posts inline comments on problematic files
4. Shows results in a dashboard
5. Enforces repo limits based on subscription

---

## User Journey

```
1. User visits shiplint.app/pricing
2. Clicks "Start Free Trial" or "Subscribe Solo"
3. Redirected to GitHub OAuth → grants repo access
4. Redirected to Stripe Checkout → pays $9
5. Redirected back to dashboard
6. Installs GitHub App on selected repos (up to 3)
7. Opens PR → ShipLint runs → inline comments appear
8. Views results in dashboard
```

---

## Features (Solo Tier)

| Feature | Priority | Notes |
|---------|----------|-------|
| GitHub App installation | P0 | Core functionality |
| PR check runs | P0 | Trigger on PR open/sync |
| Inline PR comments | P0 | Annotate specific files/lines |
| Check status (pass/fail) | P0 | Red/green on PR |
| Dashboard: scan history | P1 | List of recent scans |
| Dashboard: view findings | P1 | Details per scan |
| Repo limit (3 repos) | P1 | Enforce subscription |
| Stripe subscription | P0 | Billing |
| GitHub OAuth | P0 | Auth |

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        shiplint.app                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │   Landing    │     │  Dashboard   │    │   Webhook    │ │
│  │   /pricing   │     │  /dashboard  │    │  /api/ghook  │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │   API Server      │                   │
│                    │   (Node/Express)  │                   │
│                    └─────────┬─────────┘                   │
│                              │                              │
│         ┌────────────────────┼────────────────────┐        │
│         │                    │                    │        │
│  ┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐  │
│  │  SQLite DB  │     │   Stripe    │     │   GitHub    │  │
│  │  users,     │     │   billing   │     │   API       │  │
│  │  scans,     │     │             │     │   checks,   │  │
│  │  repos      │     │             │     │   comments  │  │
│  └─────────────┘     └─────────────┘     └─────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

```sql
-- Users (linked to GitHub)
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  github_id TEXT UNIQUE NOT NULL,
  github_login TEXT NOT NULL,
  email TEXT,
  stripe_customer_id TEXT,
  subscription_tier TEXT DEFAULT 'free', -- free, solo, team, business
  subscription_status TEXT DEFAULT 'none', -- none, active, canceled, past_due
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Repo installations
CREATE TABLE installations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  github_installation_id TEXT NOT NULL,
  repo_full_name TEXT NOT NULL, -- "owner/repo"
  repo_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, repo_full_name)
);

-- Scan history
CREATE TABLE scans (
  id INTEGER PRIMARY KEY,
  installation_id INTEGER REFERENCES installations(id),
  pr_number INTEGER,
  commit_sha TEXT,
  status TEXT, -- running, completed, failed
  findings_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  findings_json TEXT, -- full results
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);
```

---

## API Endpoints

### Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/github` | GET | Redirect to GitHub OAuth |
| `/auth/github/callback` | GET | Handle OAuth callback |
| `/auth/logout` | POST | Clear session |

### Billing
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/checkout` | POST | Create Stripe checkout session |
| `/api/portal` | POST | Get Stripe customer portal URL |
| `/api/webhook/stripe` | POST | Stripe webhook handler |

### GitHub Webhook
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/webhook/github` | POST | Handle PR events, installation events |

### Dashboard API
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me` | GET | Current user + subscription |
| `/api/installations` | GET | List user's repo installations |
| `/api/installations/:id` | DELETE | Remove installation |
| `/api/scans` | GET | List recent scans |
| `/api/scans/:id` | GET | Get scan details |

---

## GitHub App Setup

### Required Permissions
| Permission | Access | Why |
|------------|--------|-----|
| Checks | Read & Write | Create check runs, post status |
| Pull requests | Read & Write | Read PR info, post comments |
| Contents | Read | Clone repo for scanning |
| Metadata | Read | Basic repo info |

### Webhook Events
| Event | Handler |
|-------|---------|
| `pull_request.opened` | Trigger scan |
| `pull_request.synchronize` | Re-scan on new commits |
| `installation.created` | Record installation |
| `installation.deleted` | Remove installation |
| `installation_repositories.added` | Add repos |
| `installation_repositories.removed` | Remove repos |

---

## PR Integration Flow

```
1. User opens PR
   └─> GitHub sends `pull_request.opened` webhook

2. Webhook handler:
   ├─> Verify signature
   ├─> Check user subscription (active? under repo limit?)
   ├─> Create Check Run (status: "in_progress")
   └─> Queue scan job

3. Scan job:
   ├─> Clone repo at PR SHA (shallow clone)
   ├─> Run shiplint scan
   ├─> Parse results
   └─> Post results

4. Post results:
   ├─> Update Check Run (status: "completed", conclusion: pass/fail)
   ├─> Post inline comments on specific files
   └─> Save scan to database

5. User sees:
   ├─> Check status on PR (green ✓ or red ✗)
   ├─> Inline comments on problematic lines
   └─> "Details" link to dashboard
```

---

## Inline Comments Example

**On the PR, user sees:**

```
📍 Info.plist

  ⚠️ ShipLint: Missing NSCameraUsageDescription
  
  Your app links AVFoundation but doesn't have a camera usage 
  description. Apple will reject with Guideline 5.1.1.
  
  Add to Info.plist:
  <key>NSCameraUsageDescription</key>
  <string>This app uses the camera to scan QR codes.</string>
```

---

## Repo Limit Enforcement

| Tier | Repo Limit | Behavior at Limit |
|------|------------|-------------------|
| Solo | 3 | Can't add more repos, prompted to upgrade |
| Team | 10 | Can't add more repos, prompted to upgrade |
| Business | Unlimited | — |

**When over limit:**
- Existing repos keep working
- Can't install on new repos
- Dashboard shows upgrade prompt

---

## File Structure

```
shiplint-app/
├── api/
│   ├── index.ts              # Express server
│   ├── routes/
│   │   ├── auth.ts           # GitHub OAuth
│   │   ├── billing.ts        # Stripe checkout/portal
│   │   ├── github-webhook.ts # PR events
│   │   ├── stripe-webhook.ts # Subscription events
│   │   └── dashboard.ts      # User API
│   ├── lib/
│   │   ├── db.ts             # SQLite wrapper
│   │   ├── github.ts         # GitHub API client
│   │   ├── stripe.ts         # Stripe helpers
│   │   └── scanner.ts        # Run shiplint
│   └── jobs/
│       └── scan.ts           # Background scan job
├── dashboard/
│   ├── index.html            # SPA or simple pages
│   ├── pricing.html
│   ├── scans.html
│   └── settings.html
├── package.json
└── README.md
```

---

## Environment Variables

```bash
# GitHub App
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SOLO=price_xxx      # $9/mo
STRIPE_PRICE_TEAM=price_xxx      # $29/mo
STRIPE_PRICE_BUSINESS=price_xxx  # $79/mo

# App
DATABASE_URL=./shiplint.db
SESSION_SECRET=
BASE_URL=https://shiplint.app
```

---

## Implementation Order

### Week 1: Core
- [ ] Register GitHub App (get App ID, keys)
- [ ] GitHub OAuth flow
- [ ] Database setup (SQLite)
- [ ] Installation webhook handler
- [ ] PR webhook → trigger scan

### Week 2: Integration
- [ ] Check Run API (post status to PR)
- [ ] Inline comments on findings
- [ ] Basic dashboard (list scans)
- [ ] Stripe subscription integration
- [ ] Repo limit enforcement

### Week 3: Polish
- [ ] Dashboard UI cleanup
- [ ] Error handling
- [ ] Rate limiting
- [ ] Logging/monitoring
- [ ] Docs + pricing page update

---

## Open Questions

1. **Hosting:** Same VPS or separate? (Rec: same VPS for now)
2. **Job queue:** Simple in-memory or Redis? (Rec: in-memory for MVP)
3. **Dashboard framework:** Plain HTML, React, or Vue? (Rec: plain HTML + HTMX for simplicity)

---

## Success Criteria

Phase 1 is complete when:
- [ ] User can subscribe to Solo ($9/mo)
- [ ] User can install on up to 3 repos
- [ ] PRs trigger automatic scans
- [ ] Inline comments appear on findings
- [ ] Dashboard shows scan history
- [ ] At least 1 paying customer

---

*Ready to build. Let's ship.* 🚀
