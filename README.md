# RecidivWatch — Repeat Offender Tracker for Reddit

> Automatically track repeat rule-breakers and alert your mod team before they cause more damage.

Reddit's built-in tools let mods remove individual posts and comments — but they have no memory. AutoModerator can't track patterns over time. Every time a user reoffends, mods have to manually dig through their history to figure out if this is the third or the tenth violation.

RecidivWatch fixes this. It runs silently in the background, counting every mod removal per user and sending instant modmail alerts when someone hits your warning, temp ban, or permanent ban thresholds — complete with their full violation history and a direct ban link.

---

## Features

### Automatic violation tracking
Every post and comment removed by a moderator is recorded against the author's profile. RecidivWatch stores the content preview, timestamp, content ID, and which mod took the action.

### Three-tier alert system
Alerts escalate automatically based on configurable thresholds:

| Level | Default trigger | Action |
|-------|----------------|--------|
| ⚠️ Warning | 3 removals in 7 days | Modmail alert sent |
| 🚫 Temp Ban | 5 removals in 7 days | Modmail with ban link |
| ⛔ Perm Ban | 3 temp ban alerts triggered | Modmail with ban link |

Each alert includes the user's full violation history, recent violations, removal timestamps, content previews, and a direct link to ban the user.

### Smart alert logic
- **Cooldown**: Alerts won't repeat within 24 hours for the same user at the same level — no spamming your mod team on every removal
- **Escalation memory**: Once a warning is sent, it won't fire again. The next alert jumps straight to temp ban
- **Perm ban based on repeat offending**: Permanent ban is recommended after a user has triggered 3 temp ban alerts — not just a raw removal count. Users who space out violations still get escalated eventually
- **Deduplication**: The same content removal can't be counted twice even if multiple events fire

### Right-click mod menu
Available on every post and comment for moderators:

- **🔍 View User History** — sends a full violation report to modmail instantly
- **🔄 Reset User Record** — clears a user's entire record (for reformed users or false positives)

### Optional auto temp-ban
Disabled by default. When enabled, RecidivWatch will automatically execute the temp ban instead of just recommending it. Mods still receive the modmail alert either way.

### Trusted flair exemptions
Users with specific flair texts (e.g. `Moderator`, `Verified`, `Contributor`) can be excluded from tracking entirely.

### Bot detection
Accounts ending in `Bot` or `_bot` (case-insensitive) are automatically skipped.

---

## How alerts work

### ⚠️ Warning modmail
```
Subject: ⚠️ RecidivWatch WARNING — u/username (3 removals in 7d)

User: u/username
Recent removals: 3 in the past 7 days
All-time removals: 3
Temp bans triggered: 0

This user has reached the warning threshold (3 removals).
No automated action has been taken. Mods may review and act at their discretion.

Recent Violations (last 7 days: 3)
1. [POST] Sat, 10 May 2026 08:00:00 GMT
   Content: "post title here"
   ID: t3_xxxxxx | Mod: u/modname
...
```

### 🚫 Temp ban modmail
```
Subject: 🚫 RecidivWatch TEMP BAN — u/username (5 removals in 7d)

User: u/username
Recent removals: 5 in the past 7 days
All-time removals: 5
Temp bans triggered: 1

A temporary ban of 3 day(s) is recommended.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)
...
```

### ⛔ Perm ban modmail
```
Subject: ⛔ RecidivWatch PERM BAN — u/username (3 temp bans)

User: u/username
All-time removals: 15
Temp bans triggered: 3

This user has been temp banned 3 times, reaching the permanent ban threshold.
Action: [Ban u/username](https://www.reddit.com/r/yoursubreddit/about/banned)

This alert will not be sent again.
...
```

---

## Configuration

All settings are configurable per subreddit under **Mod Tools → Settings → Installed Apps → RecidivWatch**.

| Setting | Default | Description |
|---------|---------|-------------|
| Warning Threshold | 3 | Removals in the lookback window to trigger a warning |
| Temp Ban Threshold | 5 | Removals in the lookback window to trigger a temp ban alert |
| Perm Ban Threshold | 3 | Number of temp ban alerts before a perm ban is recommended |
| Lookback Window (Days) | 7 | Rolling window for counting recent violations |
| Temp Ban Duration (Days) | 3 | Suggested ban duration shown in modmail |
| Alert Cooldown (Hours) | 24 | Minimum hours between alerts for the same user at the same level |
| Auto Temp-Ban | Off | Automatically execute temp bans instead of just recommending |
| Trusted Flair Texts | (empty) | Comma-separated flair texts exempt from tracking |

---

## File structure

```
src/
└── server/
    ├── index.ts              # App entry point, settings registration
    ├── core/
    │   ├── settings.ts       # Types, interfaces, settings loader
    │   ├── tracker.ts        # Redis storage, violation logic, alert evaluation
    │   └── alert.ts          # Modmail builder and sender
    └── routes/
        ├── triggers.ts       # ModAction event handler
        └── menu.ts           # Right-click context menu items
devvit.json                   # App manifest
package.json                  # Dependencies
```

---

## How it works internally

1. Every mod removal fires a `ModAction` event (`removelink` or `removecomment`)
2. `triggers.ts` picks it up, validates it (skips bots, trusted users, self-deletions)
3. The violation is written to Redis (KV store) under the user's key
4. `evaluateAlertLevel()` checks thresholds, cooldowns, and escalation state
5. If an alert level is reached, `alert.ts` builds and sends the modmail
6. `markAlertSent()` updates the user's record with the new state

All data is stored per-subreddit in Devvit's Redis KV store. No external APIs or databases required.

---

## Installation

1. Go to [developers.reddit.com/apps/recidivwatch](https://developers.reddit.com/apps/recidivwatch)
2. Click **Add to Community**
3. Select your subreddit
4. Configure thresholds under Mod Tools → Settings

---

## Development

```bash
# Install dependencies
npm install

# Playtest on your dev subreddit
devvit playtest

# Upload new version
devvit upload

# Install to subreddit
devvit install your-subreddit-name

# Stream live logs
devvit logs your-subreddit-name

# Publish to app directory
devvit publish
```

---

## Built with

- [Devvit](https://developers.reddit.com) — Reddit's developer platform
- Redis (Devvit KV Store) — violation record storage
- Reddit API — modmail, mod actions, user management

---

## License

BSD-3-Clause