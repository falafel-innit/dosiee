import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  if (!Device.isDevice) {
    console.log('Must use a physical device for notifications');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

/**
 * Schedules one local notification for a single dose.
 * Returns the notification's identifier so it can be cancelled later
 * (e.g. if the medicine/prescription gets deleted).
 */
export async function scheduleDoseNotification(medicineName, dosage, doseDateTime) {
  const trigger = new Date(doseDateTime);

  // Don't schedule notifications for times already in the past
  if (trigger.getTime() <= Date.now()) {
    return null;
  }

  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for your medicine',
      body: `Take ${medicineName}${dosage ? ` (${dosage})` : ''}`,
      sound: true,
    },
    trigger,
  });

  return identifier;
}

export async function cancelNotification(identifier) {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}