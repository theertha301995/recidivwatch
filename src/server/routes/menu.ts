import { Devvit } from '@devvit/public-api';
import {
  getUserRecord,
  formatViolationHistory,
  recentViolations,
  resetUserRecord,
} from '../core/tracker';
import { loadSettings } from '../core/settings';

// ─── View History — Post ──────────────────────────────────────────────────────

Devvit.addMenuItem({
  label: '🔍 RecidivWatch: View User History',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, kvStore, settings, ui } = context;
    const post = await reddit.getPostById(event.targetId);
    const username = post.authorName;
    if (!username) { ui.showToast({ text: 'Could not determine post author.', appearance: 'neutral' }); return; }

    const cfg = await loadSettings(settings);
    const record = await getUserRecord(kvStore, username);
    const recent = recentViolations(record, cfg.lookbackWindowDays);

    if (record.violations.length === 0) {
      ui.showToast({ text: `✅ u/${username} has no recorded violations.`, appearance: 'neutral' });
      return;
    }

    await reddit.sendPrivateMessage({
      to: `/r/${post.subredditName}`,
      subject: `📋 RecidivWatch Lookup — u/${username}`,
      text:
        `## Manual Lookup — u/${username}\n\n` +
        `**Total removals:** ${record.violations.length}\n` +
        `**Recent (${cfg.lookbackWindowDays}d):** ${recent.length}\n` +
        `**Temp bans triggered:** ${record.tempBanCount}\n` +
        `**Active temp ban:** ${record.activeTempBan ? 'Yes' : 'No'}\n\n` +
        `---\n\n**Full Violation History**\n\n` +
        formatViolationHistory(record.violations) +
        `\n\n---\n_Requested via RecidivWatch right-click menu_`,
    });
    ui.showToast({ text: `History for u/${username} sent to modmail.`, appearance: 'neutral' });
  },
});

// ─── View History — Comment ───────────────────────────────────────────────────

Devvit.addMenuItem({
  label: '🔍 RecidivWatch: View User History',
  location: 'comment',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, kvStore, settings, ui } = context;
    const comment = await reddit.getCommentById(event.targetId);
    const username = comment.authorName;
    if (!username) { ui.showToast({ text: 'Could not determine comment author.', appearance: 'neutral' }); return; }

    const cfg = await loadSettings(settings);
    const record = await getUserRecord(kvStore, username);
    const recent = recentViolations(record, cfg.lookbackWindowDays);

    if (record.violations.length === 0) {
      ui.showToast({ text: `✅ u/${username} has no recorded violations.`, appearance: 'neutral' });
      return;
    }

    await reddit.sendPrivateMessage({
      to: `/r/${comment.subredditName}`,
      subject: `📋 RecidivWatch Lookup — u/${username}`,
      text:
        `## Manual Lookup — u/${username}\n\n` +
        `**Total removals:** ${record.violations.length}\n` +
        `**Recent (${cfg.lookbackWindowDays}d):** ${recent.length}\n` +
        `**Temp bans triggered:** ${record.tempBanCount}\n` +
        `**Active temp ban:** ${record.activeTempBan ? 'Yes' : 'No'}\n\n` +
        `---\n\n**Full Violation History**\n\n` +
        formatViolationHistory(record.violations) +
        `\n\n---\n_Requested via RecidivWatch right-click menu_`,
    });
    ui.showToast({ text: `History for u/${username} sent to modmail.`, appearance: 'neutral' });
  },
});

// ─── Reset Record — Post ──────────────────────────────────────────────────────

Devvit.addMenuItem({
  label: '🔄 RecidivWatch: Reset User Record',
  location: 'post',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, kvStore, ui } = context;
    const post = await reddit.getPostById(event.targetId);
    const username = post.authorName;
    if (!username) { ui.showToast({ text: 'Could not determine post author.', appearance: 'neutral' }); return; }

    await resetUserRecord(kvStore, username);

    // Also clear their flair
    try {
      await reddit.setUserFlair({
        subredditName: post.subredditName,
        username,
        text: '',
        cssClass: '',
      });
    } catch { /* flair clear is best-effort */ }

    ui.showToast({ text: `✅ Violation record cleared for u/${username}.`, appearance: 'neutral' });
    console.log(`[RecidivWatch] Record reset for u/${username} by mod`);
  },
});

// ─── Reset Record — Comment ───────────────────────────────────────────────────

Devvit.addMenuItem({
  label: '🔄 RecidivWatch: Reset User Record',
  location: 'comment',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    const { reddit, kvStore, ui } = context;
    const comment = await reddit.getCommentById(event.targetId);
    const username = comment.authorName;
    if (!username) { ui.showToast({ text: 'Could not determine comment author.', appearance: 'neutral' }); return; }

    await resetUserRecord(kvStore, username);

    try {
      await reddit.setUserFlair({
        subredditName: comment.subredditName,
        username,
        text: '',
        cssClass: '',
      });
    } catch { /* best-effort */ }

    ui.showToast({ text: `✅ Violation record cleared for u/${username}.`, appearance: 'neutral' });
    console.log(`[RecidivWatch] Record reset for u/${username} by mod`);
  },
});