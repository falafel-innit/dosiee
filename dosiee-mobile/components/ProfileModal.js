import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';

const ANCHOR_FIELDS = [
  { key: 'breakfast_time', label: 'Breakfast' },
  { key: 'lunch_time', label: 'Lunch' },
  { key: 'dinner_time', label: 'Dinner' },
  { key: 'sleep_time', label: 'Sleep' },
  { key: 'extra_time', label: 'Extra' },
];

function timeStringToDate(str) {
  if (!str) return null;
  const [h, m] = str.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToTimeString(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDisplayTime(date) {
  if (!date) return 'Not set';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function ProfileModal({ visible, onClose }) {
  const { token, userEmail, setToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [times, setTimes] = useState({ breakfast_time: null, lunch_time: null, dinner_time: null, sleep_time: null, extra_time: null });
  const [activePicker, setActivePicker] = useState(null);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      Promise.all([
        api.get('/me', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/schedule-times', { headers: { Authorization: `Bearer ${token}` } }),
      ])
        .then(([meRes, timesRes]) => {
          setFullName(meRes.data.full_name || '');
          setPhone(meRes.data.phone || '');
          setAge(meRes.data.age ? String(meRes.data.age) : '');
          setGender(meRes.data.gender || '');
          setTimes({
            breakfast_time: timeStringToDate(timesRes.data.breakfast_time),
            lunch_time: timeStringToDate(timesRes.data.lunch_time),
            dinner_time: timeStringToDate(timesRes.data.dinner_time),
            sleep_time: timeStringToDate(timesRes.data.sleep_time),
            extra_time: timeStringToDate(timesRes.data.extra_time),
          });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setEditing(false);
    }
  }, [visible]);

  const onPickerChange = (key, event, selectedDate) => {
    setActivePicker(null);
    if (selectedDate) {
      setTimes(prev => ({ ...prev, [key]: selectedDate }));
    }
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await api.patch('/me', { full_name: fullName, phone, age: age ? parseInt(age) : null, gender },
        { headers: { Authorization: `Bearer ${token}` } });

      const timesPayload = {};
      ANCHOR_FIELDS.forEach(({ key }) => {
        if (times[key]) timesPayload[key] = dateToTimeString(times[key]);
      });
      await api.patch('/schedule-times', timesPayload, { headers: { Authorization: `Bearer ${token}` } });

      setEditing(false);
      Alert.alert('Saved', 'Your details have been updated.');
    } catch (err) {
      Alert.alert('Save failed', err.response?.data?.detail || err.message || 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <ScrollView>
              <View style={styles.avatar}>
                <Feather name="user" size={30} color={colors.primary} />
              </View>
              <Text style={styles.email}>{userEmail}</Text>

              {editing ? (
                <View style={styles.infoCard}>
                  <Text style={styles.label}>Full Name</Text>
                  <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
                  <Text style={styles.label}>Phone</Text>
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
                  <Text style={styles.label}>Age</Text>
                  <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" />
                  <Text style={styles.label}>Gender</Text>
                  <TextInput style={styles.input} value={gender} onChangeText={setGender} />

                  <Text style={[styles.label, { marginTop: spacing.md }]}>Daily Schedule Times</Text>
                  {ANCHOR_FIELDS.map(({ key, label }) => (
                    <TouchableOpacity key={key} style={styles.timeRow} onPress={() => setActivePicker(key)}>
                      <View style={styles.timeLabelWrap}>
                        <Feather name="clock" size={14} color={colors.textLight} />
                        <Text style={styles.timeLabel}>{label}</Text>
                      </View>
                      <View style={styles.timeValueWrap}>
                        <Text style={styles.timeValue}>{formatDisplayTime(times[key])}</Text>
                        <Feather name="chevron-right" size={16} color={colors.textLight} />
                      </View>
                    </TouchableOpacity>
                  ))}

                  {activePicker && (
                    <DateTimePicker
                      value={times[activePicker] || new Date()}
                      mode="time"
                      is24Hour={false}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={(event, date) => onPickerChange(activePicker, event, date)}
                    />
                  )}

                  <TouchableOpacity style={styles.saveButton} onPress={saveAll} disabled={saving}>
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save All Changes'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.infoCard}>
                  <InfoRow label="Full Name" value={fullName || '—'} />
                  <InfoRow label="Phone" value={phone || '—'} />
                  <InfoRow label="Age" value={age || '—'} />
                  <InfoRow label="Gender" value={gender || '—'} />
                  <View style={{ height: spacing.sm }} />
                  <InfoRow label="Breakfast" value={formatDisplayTime(times.breakfast_time)} />
                  <InfoRow label="Lunch" value={formatDisplayTime(times.lunch_time)} />
                  <InfoRow label="Dinner" value={formatDisplayTime(times.dinner_time)} />
                  <InfoRow label="Sleep" value={formatDisplayTime(times.sleep_time)} />
                  <InfoRow label="Extra" value={formatDisplayTime(times.extra_time)} />
                  <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
                    <Text style={styles.editButtonText}>Edit Details</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.logoutButton} onPress={() => { setToken(null); onClose(); }}>
                <Feather name="log-out" size={18} color={colors.danger} />
                <Text style={styles.logoutText}>Log Out</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: spacing.sm },
  email: { fontSize: 14, color: colors.textLight, textAlign: 'center', marginBottom: spacing.lg },
  infoCard: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, marginBottom: spacing.lg, ...shadow },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs },
  infoLabel: { color: colors.textLight, fontSize: 13 },
  infoValue: { color: colors.text, fontWeight: '600', fontSize: 13 },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm, gap: 6 },
  editButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  label: { fontSize: 12, color: colors.textLight, marginBottom: 4, marginTop: spacing.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, fontSize: 14, color: colors.text, backgroundColor: colors.background },
  saveButton: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.sm, alignItems: 'center', marginTop: spacing.md },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, paddingVertical: spacing.sm, borderRadius: 10, marginBottom: spacing.md, ...shadow },
  logoutText: { color: colors.danger, fontWeight: '600', marginLeft: spacing.xs },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  timeLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeLabel: { color: colors.text, fontSize: 13, fontWeight: '600' },
  timeValueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeValue: { color: colors.textLight, fontSize: 13 },
});