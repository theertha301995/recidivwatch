import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  kvStore: true,
});

Devvit.addSettings([
  {
    name: 'warningThreshold',
    label: 'Warning Threshold',
    helpText: 'Number of removals in the lookback window to trigger a warning modmail.',
    type: 'number',
    defaultValue: 3,
  },
  { name: 'alertCooldownHours', 
    label: 'Alert Cooldown (Hours)',
     helpText: 'Minimum hours between alerts for the same user at the same level.', 
     type: 'number', 
     defaultValue: 24
     },
{ name: 'autoTempBan',
   label: 'Auto Temp-Ban', 
   helpText: 'Automatically ban users when they hit the temp ban threshold.',
    type: 'boolean',
     defaultValue: false 
    },
  {
    name: 'tempBanThreshold',
    label: 'Temp Ban Threshold',
    helpText: 'Number of removals in the lookback window to trigger a temp ban recommendation.',
    type: 'number',
    defaultValue: 5,
  },
  {
    name: 'permBanThreshold',
    label: 'Perm Ban Threshold (All-Time)',
    helpText: 'Total all-time removals to trigger a permanent ban recommendation.',
    type: 'number',
    defaultValue: 10,
  },
  {
    name: 'lookbackWindowDays',
    label: 'Lookback Window (Days)',
    helpText: 'How many days back to count removals for warning and temp ban thresholds.',
    type: 'number',
    defaultValue: 7,
  },
  {
    name: 'tempBanDurationDays',
    label: 'Temp Ban Duration (Days)',
    helpText: 'Suggested temp ban duration included in modmail recommendations.',
    type: 'number',
    defaultValue: 3,
  },
  {
    name: 'trustedFlairs',
    label: 'Trusted Flair Texts (comma-separated)',
    helpText: 'Users with these flair texts are exempt from tracking. Example: Moderator,Verified',
    type: 'string',
    defaultValue: '',
  },
]);

import './routes/triggers';
import './routes/menu';

export default Devvit;