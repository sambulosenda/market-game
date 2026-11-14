import {
  AndroidImportance,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  IosAuthorizationStatus,
  type NotificationPermissionsStatus,
  requestPermissionsAsync,
  SchedulableTriggerInputTypes,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { content } from '../content';
import { settingsStore } from '../store';
import { strings } from '../ui/strings';
import { createNotifier, type NotificationSystem } from './notifier';

const CHANNEL = 'reminders';

const isAllowed = (p: NotificationPermissionsStatus) =>
  p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL;

let channelReady: Promise<unknown> | null = null;
/** Android shows notifications through a channel, which must exist before the first one is scheduled. */
function ensureChannel() {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= setNotificationChannelAsync(CHANNEL, {
    name: strings.notifications.channel,
    importance: AndroidImportance.DEFAULT,
  });
  return channelReady;
}

const system: NotificationSystem = {
  allowed: async () => isAllowed(await getPermissionsAsync()),
  ask: async () => {
    await ensureChannel();
    return isAllowed(await requestPermissionsAsync());
  },
  schedule: async (text, at) => {
    await ensureChannel();
    return scheduleNotificationAsync({
      content: text,
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
    });
  },
  cancelAll: () => cancelAllScheduledNotificationsAsync(),
};

/** Local notifications for the app: off unless the player has switched them on in the settings. */
export const notifier = createNotifier({
  system,
  content,
  enabled: () => settingsStore.getState().notifications,
  text: strings.notifications.text,
});
