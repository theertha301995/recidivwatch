import type { KVStore } from '@devvit/public-api';
import type { UserRecord, ViolationEvent, AlertLevel, RecidivWatchSettings } from './settings';

const KEY_PREFIX = 'rcw:user:';

function userKey(username: string): string {
  return `${KEY_PREFIX}${username.toLowerCase()}`;
}

export async function getUserRecord(kv: KVStore, username: string): Promise<UserRecord> {
  const raw = await kv.get(userKey(username));
  if (!raw) {
    return {
      username,
      violations: [],
      activeTempBan: false,
      permBanAlertSent: false,
      tempBanCount: 0,
      lastAlertAt: {},
      warningSentAt: null,
    };
  }
  const record = JSON.parse(raw as string) as UserRecord;
  // backfill new fields for existing records
  if (record.tempBanCount === undefined) record.tempBanCount = 0;
  if (record.lastAlertAt === undefined) record.lastAlertAt = {};
  if (record.warningSentAt === undefined) record.warningSentAt = null;
  return record;
}

export async function saveUserRecord(kv: KVStore, record: UserRecord): Promise<void> {
  await kv.put(userKey(record.username), JSON.stringify(record));
}

export async function recordViolation(
  kv: KVStore,
  username: string,
  event: ViolationEvent
): Promise<UserRecord> {
  const record = await getUserRecord(kv, username);

  // Deduplicate by contentId
  const alreadyRecorded = record.violations.some((v) => v.contentId === event.contentId);
  if (alreadyRecorded) return record;

  record.violations.push(event);
  await saveUserRecord(kv, record);
  return record;
}

export function recentViolations(record: UserRecord, lookbackDays: number): ViolationEvent[] {
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;
  return record.violations.filter((v) => v.timestamp >= cutoff);
}

/**
 * Check if an alert level is on cooldown.
 */
function isOnCooldown(record: UserRecord, level: AlertLevel, cooldownHours: number): boolean {
  const lastSent = record.lastAlertAt[level];
  if (!lastSent) return false;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return Date.now() - lastSent < cooldownMs;
}

/**
 * Evaluate alert level with cooldown + escalation memory.
 *
 * Perm ban: triggered after tempBanCount >= permBanThreshold (number of temp bans)
 * Temp ban: triggered when recent violations >= tempBanThreshold, not on cooldown
 * Warning: triggered when recent violations >= warningThreshold,
 *          only if warning hasn't been sent yet in this window
 */
export function evaluateAlertLevel(
  record: UserRecord,
  recent: ViolationEvent[],
  settings: RecidivWatchSettings
): AlertLevel {
  const recentCount = recent.length;

  // Perm ban check — based on how many temp bans have been triggered
  if (record.tempBanCount >= settings.permBanThreshold) {
    if (record.permBanAlertSent) return 'none';
    return 'permban';
  }

  // Temp ban check
  if (recentCount >= settings.tempBanThreshold) {
    if (isOnCooldown(record, 'tempban', settings.alertCooldownHours)) return 'none';
    return 'tempban';
  }

  // Warning check — only fire once per rolling window
  if (recentCount >= settings.warningThreshold) {
    if (record.warningSentAt !== null) return 'none'; // already warned this window
    return 'warning';
  }

  return 'none';
}

export async function markAlertSent(
  kv: KVStore,
  username: string,
  level: AlertLevel
): Promise<void> {
  const record = await getUserRecord(kv, username);
  record.lastAlertAt[level] = Date.now();

  if (level === 'warning') {
    record.warningSentAt = Date.now();
  }

  if (level === 'tempban') {
    record.tempBanCount += 1;
    record.activeTempBan = true;
  }

  if (level === 'permban') {
    record.permBanAlertSent = true;
  }

  await saveUserRecord(kv, record);
}

/**
 * Reset a user's violation record — called from the appeal/reset menu.
 */
export async function resetUserRecord(kv: KVStore, username: string): Promise<void> {
  const record = await getUserRecord(kv, username);
  record.violations = [];
  record.activeTempBan = false;
  record.permBanAlertSent = false;
  record.tempBanCount = 0;
  record.lastAlertAt = {};
  record.warningSentAt = null;
  await saveUserRecord(kv, record);
}

export function formatViolationHistory(violations: ViolationEvent[]): string {
  if (violations.length === 0) return '_No violations recorded._';

  return violations
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((v, i) => {
      const date = new Date(v.timestamp).toUTCString();
      const type = v.type.toUpperCase();
      const preview = v.contentPreview.length > 80
        ? v.contentPreview.slice(0, 77) + '...'
        : v.contentPreview;
      return `${i + 1}. [${type}] ${date}\n   Content: "${preview}"\n   ID: ${v.contentId} | Mod: u/${v.modUsername}`;
    })
    .join('\n\n');
}

export function isTrustedUser(
  userFlairText: string | undefined | null,
  trustedFlairs: string[]
): boolean {
  if (!userFlairText || trustedFlairs.length === 0) return false;
  return trustedFlairs.includes(userFlairText.toLowerCase());
}

