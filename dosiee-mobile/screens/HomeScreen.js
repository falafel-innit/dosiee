import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';
import ProfileModal from '../components/ProfileModal';

export default function HomeScreen({ navigation }) {
  const { token } = useAuth();
  const [doses, setDoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  const fetchDoses = async () => {
    try {
      const res = await api.get('/doses/today', { headers: { Authorization: `Bearer ${token}` } });
      setDoses(res.data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchDoses(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchDoses(); };

  const toggleTaken = async (doseId) => {
    setDoses(prev => prev.map(d => d.id === doseId ? { ...d, taken: !d.taken } : d));
    try {
      await api.patch(`/doses/${doseId}/toggle`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      fetchDoses();
    }
  };

  const renderDose = ({ item }) => {
    const time = new Date(item.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return (
      <View style={[styles.card, item.taken && styles.cardTaken]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.medName}>{item.medicine_name}</Text>
          <Text style={styles.medDetail}>{item.dosage} · {time}</Text>
        </View>
        <TouchableOpacity onPress={() => toggleTaken(item.id)} style={styles.checkButton}>
          <Feather name={item.taken ? 'check-circle' : 'circle'} size={28} color={item.taken ? colors.success : colors.border} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setProfileVisible(true)} style={styles.profileIcon}>
          <Feather name="user" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.appTitle}>Dosiee</Text>
        <View style={{ width: 36 }} />
      </View>

      <Text style={styles.sectionTitle}>Today's Schedule</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={doses}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderDose}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: spacing.xl, paddingHorizontal: spacing.lg }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="calendar" size={40} color={colors.border} />
              <Text style={styles.empty}>No doses scheduled yet</Text>
              <Text style={styles.emptySub}>Upload your first prescription to get started</Text>
            </View>
          }
        />
      )}

      <View style={styles.uploadWrap}>
        <TouchableOpacity style={styles.uploadButton} onPress={() => navigation.navigate('Upload')}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.uploadButtonText}>Upload Prescription</Text>
        </TouchableOpacity>
      </View>

      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  profileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center' },
  appTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', ...shadow },
  cardTaken: { opacity: 0.55 },
  medName: { fontSize: 16, fontWeight: '600', color: colors.text },
  medDetail: { fontSize: 13, color: colors.textLight, marginTop: 2 },
  checkButton: { padding: spacing.xs },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl * 2 },
  empty: { textAlign: 'center', color: colors.textLight, marginTop: spacing.md, fontWeight: '600' },
  emptySub: { color: colors.textLight, fontSize: 13, marginTop: 4, textAlign: 'center' },
  uploadWrap: { padding: spacing.lg },
  uploadButton: { backgroundColor: colors.primary, borderRadius: 12, padding: spacing.md, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...shadow },
  uploadButtonText: { color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: spacing.xs },
});