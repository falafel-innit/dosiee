import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';
import { scheduleDoseNotification, cancelNotificationsForPrescription, saveNotificationIdsForPrescription } from '../services/notifications';

const ANCHORS = ['breakfast', 'lunch', 'dinner', 'sleep', 'extra'];
const RELATION_RULES = {
  breakfast: ['before', 'after'],
  lunch: ['before', 'after'],
  dinner: ['before', 'after'],
  sleep: ['before'],
  extra: ['before', 'after', 'exact'],
};
const LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', sleep: 'Sleep', extra: 'Extra',
  before: 'Before', after: 'After', exact: 'Exact time' };

export default function PrescriptionReviewScreen({ route, navigation }) {
  const { id } = route.params;
  const { token } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/prescriptions/${id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const withIds = res.data.parsed_data.map((m, idx) => ({
          ...m, id: idx + 1,
          timing_slots: [{ anchor: 'breakfast', relation: 'after' }],
        }));
        setMedicines(withIds);
        setFileUrl(res.data.file_url);
      })
      .catch(() => Alert.alert('Error', 'Could not load prescription details'))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (mid, field, value) => setMedicines(medicines.map(m => m.id === mid ? { ...m, [field]: value } : m));
  const removeMedicine = (mid) => setMedicines(medicines.filter(m => m.id !== mid));
  const addMedicine = () => setMedicines([...medicines, {
    id: Date.now(), name: '', dosage: '', frequency: 'Once daily', duration_days: 7,
    confidence: 'high', raw_ocr_text: '',
    timing_slots: [{ anchor: 'breakfast', relation: 'after' }],
  }]);

  const addSlot = (mid) => {
    setMedicines(medicines.map(m => m.id === mid
      ? { ...m, timing_slots: [...m.timing_slots, { anchor: 'lunch', relation: 'after' }] }
      : m));
  };
  const removeSlot = (mid, slotIdx) => {
    setMedicines(medicines.map(m => m.id === mid
      ? { ...m, timing_slots: m.timing_slots.filter((_, i) => i !== slotIdx) }
      : m));
  };
  const updateSlotAnchor = (mid, slotIdx, anchor) => {
    const validRelations = RELATION_RULES[anchor];
    setMedicines(medicines.map(m => {
      if (m.id !== mid) return m;
      const slots = [...m.timing_slots];
      const currentRelation = slots[slotIdx].relation;
      slots[slotIdx] = { anchor, relation: validRelations.includes(currentRelation) ? currentRelation : validRelations[0] };
      return { ...m, timing_slots: slots };
    }));
  };
  const updateSlotRelation = (mid, slotIdx, relation) => {
    setMedicines(medicines.map(m => {
      if (m.id !== mid) return m;
      const slots = [...m.timing_slots];
      slots[slotIdx] = { ...slots[slotIdx], relation };
      return { ...m, timing_slots: slots };
    }));
  };

  const scheduleMedicines = async () => {
  if (medicines.length === 0) {
    Alert.alert('No medicines', 'Add at least one medicine before scheduling.');
    return;
  }
  setSubmitting(true);
  try {
    const payload = {
      medicines: medicines.map(m => ({
        name: m.name, dosage: m.dosage, frequency: m.frequency,
        duration_days: parseInt(m.duration_days) || 7,
        timing_slots: m.timing_slots,
      })),
    };
    const response = await api.post(`/prescriptions/${id}/confirm`, payload, { headers: { Authorization: `Bearer ${token}` } });

    // NEW: schedule a local notification for every dose returned
    const doses = response.data.doses || [];

    // Cancel any notifications left over from an earlier "Schedule" tap on
    // this same prescription, so retries/re-confirms never pile up duplicates.
    await cancelNotificationsForPrescription(id);

    const identifiers = [];
    for (const dose of doses) {
      const identifier = await scheduleDoseNotification(dose.medicine_name, dose.dosage, dose.scheduled_time);
      identifiers.push(identifier);
    }
    await saveNotificationIdsForPrescription(id, identifiers);

    Alert.alert('Scheduled', `${medicines.length} medicine(s) added, with ${doses.length} reminder(s) set.`);
    navigation.navigate('HomeTab');
  } catch (err) {
    Alert.alert('Failed to schedule', err.response?.data?.detail || 'Something went wrong');
  } finally {
    setSubmitting(false);
  }
};

  const isImage = (url) => url && /\.(jpg|jpeg|png)$/i.test(url);

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Review Prescription</Text>
      <Text style={styles.subtitle}>Check the details and set when each medicine should be taken</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {isImage(fileUrl) && (
          <Image source={{ uri: `${BASE_URL}${fileUrl}` }} style={styles.preview} resizeMode="contain" />
        )}

        {medicines.map((med) => (
          <View key={med.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="package" size={18} color={colors.primary} />
              <TouchableOpacity onPress={() => removeMedicine(med.id)}>
                <Feather name="trash-2" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Medicine name</Text>
            <TextInput style={styles.input} value={med.name} onChangeText={(v) => updateField(med.id, 'name', v)} placeholder="e.g. Metformin" />

            {med.confidence === 'low' && (
              <View style={styles.lowConfidenceBanner}>
                <Feather name="alert-triangle" size={14} color="#E9A23B" />
                <Text style={styles.lowConfidenceText}>
                  Couldn't confidently match this name. OCR read: "{med.raw_ocr_text}"
                </Text>
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={styles.label}>Dosage</Text>
                <TextInput style={styles.input} value={med.dosage} onChangeText={(v) => updateField(med.id, 'dosage', v)} placeholder="e.g. 500mg" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Duration (days)</Text>
                <TextInput style={styles.input} value={String(med.duration_days)} onChangeText={(v) => updateField(med.id, 'duration_days', v)} keyboardType="numeric" placeholder="e.g. 30" />
              </View>
            </View>

            <Text style={styles.label}>When to take (one row per dose per day)</Text>
            {med.timing_slots.map((slot, slotIdx) => (
              <View key={slotIdx} style={styles.slotRow}>
                <View style={styles.chipGroup}>
                  {ANCHORS.map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[styles.chip, slot.anchor === a && styles.chipActive]}
                      onPress={() => updateSlotAnchor(med.id, slotIdx, a)}
                    >
                      <Text style={[styles.chipText, slot.anchor === a && styles.chipTextActive]}>{LABELS[a]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.chipGroup}>
                  {RELATION_RULES[slot.anchor].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.chip, slot.relation === r && styles.chipActiveAlt]}
                      onPress={() => updateSlotRelation(med.id, slotIdx, r)}
                    >
                      <Text style={[styles.chipText, slot.relation === r && styles.chipTextActive]}>{LABELS[r]}</Text>
                    </TouchableOpacity>
                  ))}
                  {med.timing_slots.length > 1 && (
                    <TouchableOpacity onPress={() => removeSlot(med.id, slotIdx)} style={styles.removeSlot}>
                      <Feather name="x" size={14} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity style={styles.addSlotButton} onPress={() => addSlot(med.id)}>
              <Feather name="plus" size={14} color={colors.primary} />
              <Text style={styles.addSlotText}>Add another dose time</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={addMedicine}>
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={styles.addButtonText}>Add another medicine</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity style={styles.confirmButton} onPress={scheduleMedicines} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Schedule</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textLight, marginTop: 2, marginBottom: spacing.md },
  preview: { width: '100%', height: 200, borderRadius: 12, marginBottom: spacing.md, backgroundColor: colors.card },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, ...shadow },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  label: { fontSize: 12, color: colors.textLight, marginBottom: 4, marginTop: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.sm, fontSize: 14, color: colors.text },
  row: { flexDirection: 'row' },
  lowConfidenceBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFF3E0', borderRadius: 8, padding: spacing.sm, marginTop: spacing.xs, gap: 6 },
  lowConfidenceText: { fontSize: 11, color: '#9A6A1F', flex: 1 },
  slotRow: { marginBottom: spacing.sm, backgroundColor: colors.background, borderRadius: 10, padding: spacing.sm, marginTop: spacing.sm },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipActiveAlt: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  chipText: { fontSize: 12, color: colors.textLight, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  removeSlot: { paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'center' },
  addSlotButton: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  addSlotText: { color: colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 4 },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.sm, marginBottom: spacing.lg },
  addButtonText: { color: colors.primary, fontWeight: '600', marginLeft: spacing.xs },
  confirmButton: { backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, alignItems: 'center', ...shadow },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});