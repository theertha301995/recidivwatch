import type { SettingsClient } from '@devvit/public-api';

export interface RecidivWatchSettings {
  warningThreshold: number;
  tempBanThreshold: number;
  permBanThreshold: number;
  lookbackWindowDays: number;
  tempBanDurationDays: number;
  alertCooldownHours: number;
  autoTempBan: boolean;
  trustedFlairs: string[];
}

export const DEFAULT_SETTINGS: RecidivWatchSettings = {
  warningThreshold: 3,
  tempBanThreshold: 5,
  permBanThreshold: 3, // number of temp bans triggered before perm ban alert
  lookbackWindowDays: 7,
  tempBanDurationDays: 3,
  alertCooldownHours: 24,
  autoTempBan: false,
  trustedFlairs: [],
};

export async function loadSettings(settings: SettingsClient): Promise<RecidivWatchSettings> {
  const [
    warningThreshold,
    tempBanThreshold,
    permBanThreshold,
    lookbackWindowDays,
    tempBanDurationDays,
    alertCooldownHours,
    autoTempBan,
    trustedFlairsRaw,
  ] = await Promise.all([
    settings.get<number>('warningThreshold'),
    settings.get<number>('tempBanThreshold'),
    settings.get<number>('permBanThreshold'),
    settings.get<number>('lookbackWindowDays'),
    settings.get<number>('tempBanDurationDays'),
    settings.get<number>('alertCooldownHours'),
    settings.get<boolean>('autoTempBan'),
    settings.get<string>('trustedFlairs'),
  ]);

  const trustedFlairs = trustedFlairsRaw
    ? trustedFlairsRaw.split(',').map((f) => f.trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    warningThreshold: warningThreshold ?? DEFAULT_SETTINGS.warningThreshold,
    tempBanThreshold: tempBanThreshold ?? DEFAULT_SETTINGS.tempBanThreshold,
    permBanThreshold: permBanThreshold ?? DEFAULT_SETTINGS.permBanThreshold,
    lookbackWindowDays: lookbackWindowDays ?? DEFAULT_SETTINGS.lookbackWindowDays,
    tempBanDurationDays: tempBanDurationDays ?? DEFAULT_SETTINGS.tempBanDurationDays,
    alertCooldownHours: alertCooldownHours ?? DEFAULT_SETTINGS.alertCooldownHours,
    autoTempBan: autoTempBan ?? DEFAULT_SETTINGS.autoTempBan,
    trustedFlairs,
  };
}

export interface ViolationEvent {
  timestamp: number;
  type: 'post' | 'comment' | 'report';
  contentId: string;
  subreddit: string;
  contentPreview: string;
  modUsername: string;
}

export interface UserRecord {
  username: string;
  violations: ViolationEvent[];
  activeTempBan: boolean;
  permBanAlertSent: boolean;
  // how many times a temp ban alert has been triggered
  tempBanCount: number;
  // timestamp of last alert per level, for cooldown
  lastAlertAt: Partial<Record<AlertLevel, number>>;
  // whether a warning alert has been sent in the current window
  warningSentAt: number | null;
}

export type AlertLevel = 'none' | 'warning' | 'tempban' | 'permban';