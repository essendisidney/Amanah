import { Platform } from 'react-native';
import { apiPost } from './api';

/** Register Expo push token when permissions allow. Soft-fails if package unavailable. */
export async function registerDevicePushToken(accessToken: string): Promise<void> {
  try {
    // Dynamic require so typecheck still works if dependency isn't installed yet locally.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof import('expo-device');

    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const tokenResult = await Notifications.getExpoPushTokenAsync();
    const token = tokenResult.data;
    if (!token) return;

    await apiPost('/api/v1/push-token', accessToken, {
      token,
      platform: 'expo',
    });
  } catch {
    // Optional path: env token fallback handled by caller
  }
}
