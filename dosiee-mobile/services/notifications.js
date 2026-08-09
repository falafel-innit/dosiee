import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'notifIds:prescription:';

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

  console.log('Notification permission status:', finalStatus);
  return finalStatus === 'granted';
}

/**
 * Schedules one local notification for a single dose.
 * Returns the notification's identifier so it can be cancelled later
 * (e.g. if the medicine/prescription gets deleted).
 */
export async function scheduleDoseNotification(medicineName, dosage, doseDateTime) {
  // Backend runs directly on the Windows host (not in Docker) and computes
  // scheduled_time using the system clock, which is IST. As long as the
  // phone is also set to IST, this naive timestamp already represents the
  // correct local wall-clock time — no timezone conversion needed here.
  const trigger = new Date(doseDateTime);

  if (isNaN(trigger.getTime())) {
    console.warn('Invalid dose date, skipping notification:', doseDateTime);
    return null;
  }

  // Don't schedule notifications for times already in the past
  if (trigger.getTime() <= Date.now()) {
    return null;
  }

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time for your medicine',
        body: `Take ${medicineName}${dosage ? ` (${dosage})` : ''}`,
        sound: true,
      },
      // expo-notifications 0.31+ requires an explicit trigger type — passing a
      // bare Date object (the old shorthand) no longer schedules reliably.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: trigger,
      },
    });
    return identifier;
  } catch (e) {
    console.warn('Failed to schedule notification:', e);
    return null;
  }
}

export async function cancelNotification(identifier) {
  if (!identifier) return;
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancels any notifications previously scheduled for this prescription
 * (e.g. from an earlier "Schedule" tap on the same prescription), so
 * re-confirming never leaves duplicate reminders behind.
 */
export async function cancelNotificationsForPrescription(prescriptionId) {
  const key = `${STORAGE_PREFIX}${prescriptionId}`;
  const stored = await AsyncStorage.getItem(key);
  if (stored) {
    const ids = JSON.parse(stored);
    await Promise.all(ids.map((id) => cancelNotification(id)));
  }
  await AsyncStorage.removeItem(key);
}

/**
 * Saves the identifiers returned by scheduleDoseNotification so they can
 * be looked up and cancelled later (see cancelNotificationsForPrescription).
 */
export async function saveNotificationIdsForPrescription(prescriptionId, identifiers) {
  const key = `${STORAGE_PREFIX}${prescriptionId}`;
  const ids = identifiers.filter(Boolean);
  await AsyncStorage.setItem(key, JSON.stringify(ids));
}