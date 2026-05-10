import { Devvit } from '@devvit/public-api';
import type { TriggerContext } from '@devvit/public-api';
import { loadSettings, type ViolationEvent } from '../core/settings';
import {
  recordViolation,
  recentViolations,
  evaluateAlertLevel,
  markAlertSent,
  isTrustedUser,
 
} from '../core/tracker';
import { maybeAlert } from '../core/alert';

async function handleRemoval(
  context: TriggerContext,
  params: {
    username: string;
    subreddit: string;
    contentId: string;
    contentPreview: string;
    type: 'post' | 'comment';
    modUsername: string;
    userFlairText?: string | null;
  }
): Promise<void> {
  const { username, subreddit, contentId, contentPreview, type, modUsername, userFlairText } = params;

  console.log(`[RecidivWatch] handleRemoval called for u/${username}`);

  const settings = await loadSettings(context.settings);

  if (!username || username === '[deleted]' || /bot$/i.test(username)) return;
  if (isTrustedUser(userFlairText, settings.trustedFlairs)) {
    console.log(`[RecidivWatch] Skipping trusted user: u/${username}`);
    return;
  }
  if (!modUsername || modUsername === username) return;

  const violation: ViolationEvent = {
    timestamp: Date.now(),
    type,
    contentId,
    subreddit,
    contentPreview,
    modUsername,
  };

  const record = await recordViolation(context.kvStore, username, violation);
  const recent = recentViolations(record, settings.lookbackWindowDays);
  const level = evaluateAlertLevel(record, recent, settings);

  console.log(
    `[RecidivWatch] u/${username} - total: ${record.violations.length}, recent: ${recent.length}, level: ${level}`
  );

  if (level === 'none') return;

  // Send modmail alert
  await maybeAlert(context.reddit, level, username, record, settings, subreddit);

  // Mark alert sent (updates cooldown, tempBanCount, flags)
  await markAlertSent(context.kvStore, username, level);

  // Auto temp-ban if enabled and level is tempban
  if (level === 'tempban' && settings.autoTempBan) {
    try {
      await context.reddit.banUser({
        subredditName: subreddit,
        username,
        duration: settings.tempBanDurationDays,
        reason: `RecidivWatch: ${record.violations.length} violations recorded`,
        message: `You have been temporarily banned for ${settings.tempBanDurationDays} day(s) due to repeated rule violations.`,
      });
      console.log(`[RecidivWatch] Auto temp-banned u/${username} for ${settings.tempBanDurationDays} days`);
    } catch (err) {
      console.error(`[RecidivWatch] Failed to auto temp-ban u/${username}:`, err);
    }
  }

  
 
}

Devvit.addTrigger({
  event: 'ModAction',
  onEvent: async (event, context) => {
    console.log(`[RecidivWatch] ModAction fired: ${event.action}`);

    if (event.action !== 'removelink' && event.action !== 'removecomment') return;

    const username = event.targetUser?.name;
    if (!username) return;

    const type: 'post' | 'comment' = event.action === 'removelink' ? 'post' : 'comment';
    const contentId = event.targetPost?.id ?? event.targetComment?.id ?? '';
    const contentPreview = type === 'post'
      ? (event.targetPost?.title ?? contentId)
      : (event.targetComment?.body?.slice(0, 120) ?? contentId);

    await handleRemoval(context, {
      username,
      subreddit: event.subreddit?.name ?? context.subredditName ?? '',
      contentId,
      contentPreview,
      type,
      modUsername: event.moderator?.name ?? 'unknown_mod',
      userFlairText: event.targetUser?.flair?.text,
    });
  },
});