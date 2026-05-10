import type { RedditAPIClient } from '@devvit/public-api';
import type { UserRecord, ViolationEvent, AlertLevel, RecidivWatchSettings } from './settings';
import { formatViolationHistory, recentViolations } from './tracker';

interface AlertPayload {
  subject: string;
  body: string;
}

export function buildAlert(
  level: AlertLevel,
  username: string,
  record: UserRecord,
  recent: ViolationEvent[],
  settings: RecidivWatchSettings,
  subreddit: string
): AlertPayload | null {
  const totalCount = record.violations.length;
  const recentCount = recent.length;
  const profileUrl = `https://www.reddit.com/user/${username}`;
  const modlogUrl = `https://www.reddit.com/r/${subreddit}/about/log/?mod=all&type=removelink`;
  const banUrl = `https://www.reddit.com/r/${subreddit}/about/banned`;

  const historySection = `\n\n---\n\n**Full Violation History (${totalCount} total)**\n\n${formatViolationHistory(record.violations)}`;
  const recentSection = recentCount > 0
    ? `\n\n**Recent Violations (last ${settings.lookbackWindowDays} days: ${recentCount})**\n\n${formatViolationHistory(recent)}`
    : '';
  const footer = `\n\n---\n_RecidivWatch | [User Profile](${profileUrl}) | [Mod Log](${modlogUrl})_`;

  switch (level) {
    case 'warning':
      return {
        subject: `⚠️ RecidivWatch WARNING — u/${username} (${recentCount} removals in ${settings.lookbackWindowDays}d)`,
        body:
          `## ⚠️ Repeat Violation Warning\n\n` +
          `**User:** u/${username}\n` +
          `**Recent removals:** ${recentCount} in the past ${settings.lookbackWindowDays} days\n` +
          `**All-time removals:** ${totalCount}\n` +
          `**Temp bans triggered:** ${record.tempBanCount}\n\n` +
          `This user has reached the **warning threshold** (${settings.warningThreshold} removals). ` +
          `User flair has been updated to ⚠️ Warned. No automated action has been taken.` +
          recentSection + historySection + footer,
      };

    case 'tempban':
      return {
        subject: `🚫 RecidivWatch TEMP BAN — u/${username} (${recentCount} removals in ${settings.lookbackWindowDays}d)`,
        body:
          `## 🚫 Temporary Ban ${settings.autoTempBan ? 'Executed' : 'Recommended'}\n\n` +
          `**User:** u/${username}\n` +
          `**Recent removals:** ${recentCount} in the past ${settings.lookbackWindowDays} days\n` +
          `**All-time removals:** ${totalCount}\n` +
          `**Temp bans triggered:** ${record.tempBanCount + 1}\n\n` +
          (settings.autoTempBan
            ? `This user has been **automatically temp banned** for ${settings.tempBanDurationDays} day(s).`
            : `A temporary ban of **${settings.tempBanDurationDays} day(s)** is recommended.\n\n> **Action:** [Ban u/${username}](${banUrl})`) +
          `\n\nUser flair has been updated to 🚫 Temp Banned.` +
          recentSection + historySection + footer,
      };

    case 'permban':
      return {
        subject: `⛔ RecidivWatch PERM BAN — u/${username} (${record.tempBanCount} temp bans)`,
        body:
          `## ⛔ Permanent Ban Recommended\n\n` +
          `**User:** u/${username}\n` +
          `**All-time removals:** ${totalCount}\n` +
          `**Temp bans triggered:** ${record.tempBanCount}\n\n` +
          `This user has been temp banned **${record.tempBanCount} times**, reaching the permanent ban threshold. ` +
          `A permanent ban is strongly recommended.\n\n` +
          `> **Action:** [Ban u/${username}](${banUrl})\n\n` +
          `User flair has been updated to ⛔ Banned. _This alert will not be sent again._` +
          historySection + footer,
      };

    default:
      return null;
  }
}

export async function sendModmailAlert(
  reddit: RedditAPIClient,
  subreddit: string,
  payload: AlertPayload
): Promise<void> {
  await reddit.sendPrivateMessage({
    to: `/r/${subreddit}`,
    subject: payload.subject,
    text: payload.body,
  });
}

export async function maybeAlert(
  reddit: RedditAPIClient,
  level: AlertLevel,
  username: string,
  record: UserRecord,
  settings: RecidivWatchSettings,
  subreddit: string
): Promise<AlertLevel> {
  if (level === 'none') return 'none';

  const recent = recentViolations(record, settings.lookbackWindowDays);
  const payload = buildAlert(level, username, record, recent, settings, subreddit);
  if (!payload) return 'none';

  await sendModmailAlert(reddit, subreddit, payload);
  return level;
}