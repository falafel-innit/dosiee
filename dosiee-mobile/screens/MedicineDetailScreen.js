import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';

export default function MedicineDetailScreen({ route }) {
  const { prescriptionId } = route.params;
  const { token } = useAuth();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/prescriptions/${prescriptionId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setMedicines(res.data.parsed_data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /></View>;
  }
  if (medicines.length === 0) {
    return <View style={styles.container}><Text style={styles.empty}>No medicine details found for this prescription.</Text></View>;
  }

  return (
    <ScrollView style={styles.container}>
      {medicines.map((med, idx) => (
        <View key={idx} style={styles.card}>
          <View style={styles.iconCircle}>
            <Feather name="package" size={24} color={colors.primary} />
          </View>
          <Text style={styles.name}>{med.name}</Text>
          <Text style={styles.dosage}>{med.dosage} · {med.frequency}</Text>
          <View style={styles.row}>
            <Feather name="calendar" size={16} color={colors.textLight} />
            <Text style={styles.rowLabel}>Duration</Text>
            <Text style={styles.rowValue}>{med.duration_days} days</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md, ...shadow },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  name: { fontSize: 20, fontWeight: '700', color: colors.text },
  dosage: { fontSize: 13, color: colors.textLight, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  rowLabel: { marginLeft: spacing.sm, color: colors.textLight, fontSize: 13, flex: 1 },
  rowValue: { color: colors.text, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', color: colors.textLight, marginTop: spacing.xl },
});