import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api, { BASE_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';

const statusStyles = {
  uploaded: { bg: '#FFF3E0', color: '#E9A23B', label: 'Needs Parsing' },
  processing: { bg: '#F0EAFB', color: '#8B5CF6', label: 'Processing...' },
  parsed: { bg: '#E3F2FD', color: '#3B82C4', label: 'Needs Review' },
  confirmed: { bg: '#EAF7F5', color: colors.success, label: 'Scheduled' },
};

export default function PrescriptionsScreen({ navigation }) {
  const { token } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuItem, setMenuItem] = useState(null);

  const fetchPrescriptions = async () => {
    try {
      const res = await api.get('/prescriptions', { headers: { Authorization: `Bearer ${token}` } });
      setPrescriptions(res.data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchPrescriptions(); }, []));

  // NEW: while any prescription is "processing", poll every 2s so the
  // badge flips to "Needs Review" automatically once the ARQ worker finishes —
  // no manual pull-to-refresh needed.
  useEffect(() => {
    const hasProcessing = prescriptions.some(p => p.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchPrescriptions();
    }, 2000);

    return () => clearInterval(interval);
  }, [prescriptions]);

  const onRefresh = () => { setRefreshing(true); fetchPrescriptions(); };

  // CHANGED: parse now just kicks off the background job and refreshes the
  // list — it no longer navigates to Review immediately, since the result
  // isn't ready yet. The polling above will pick up the status change.
  const handleParse = async (id) => {
    setMenuItem(null);
    try {
      await api.post(`/prescriptions/${id}/parse`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchPrescriptions();
    } catch (err) {
      Alert.alert('Parsing failed', err.response?.data?.detail || 'Something went wrong');
    }
  };

  const handleDelete = (id) => {
    setMenuItem(null);
    Alert.alert('Delete prescription?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/prescriptions/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setPrescriptions(prev => prev.filter(p => p.id !== id));
          } catch (err) {
            Alert.alert('Delete failed', 'Please try again');
          }
        },
      },
    ]);
  };

  const isImage = (url) => url && /\.(jpg|jpeg|png)$/i.test(url);

  const renderItem = ({ item }) => {
    const badge = statusStyles[item.status];
    return (
      <View style={styles.card}>
        {isImage(item.file_url) ? (
          <Image source={{ uri: `${BASE_URL}${item.file_url}` }} style={styles.thumbnail} />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailIcon]}>
            <Feather name="file-text" size={22} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={styles.fileName}>Prescription #{item.id}</Text>
          <Text style={styles.date}>{new Date(item.uploaded_at).toLocaleDateString()}</Text>
          <View style={[styles.badge, { backgroundColor: badge.bg, alignSelf: 'flex-start', marginTop: 4 }]}>
            {item.status === 'processing' && (
              <ActivityIndicator size="small" color={badge.color} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setMenuItem(item)} style={styles.menuButton}>
          <Feather name="more-vertical" size={20} color={colors.textLight} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prescriptions</Text>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="file-plus" size={40} color={colors.border} />
              <Text style={styles.empty}>No prescriptions yet</Text>
              <Text style={styles.emptySub}>Upload one from the Home screen to get started</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!menuItem} transparent animationType="fade" onRequestClose={() => setMenuItem(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuItem(null)}>
          <View style={styles.menuSheet}>
            {menuItem?.status === 'uploaded' && (
              <MenuAction icon="cpu" label="Parse using OCR" onPress={() => handleParse(menuItem.id)} />
            )}
            {menuItem?.status === 'parsed' && (
              <MenuAction icon="edit-3" label="Review & Schedule" onPress={() => { setMenuItem(null); navigation.navigate('PrescriptionReview', { id: menuItem.id }); }} />
            )}
            {menuItem?.status === 'confirmed' && (
              <MenuAction icon="eye" label="View Details" onPress={() => { setMenuItem(null); navigation.navigate('MedicineDetail', { prescriptionId: menuItem.id }); }} />
            )}
            <MenuAction icon="trash-2" label="Delete" danger onPress={() => handleDelete(menuItem.id)} />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function MenuAction({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity style={styles.menuAction} onPress={onPress}>
      <Feather name={icon} size={18} color={danger ? colors.danger : colors.text} />
      <Text style={[styles.menuActionText, danger && { color: colors.danger }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, ...shadow },
  thumbnail: { width: 44, height: 44, borderRadius: 8 },
  thumbnailIcon: { backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center' },
  fileName: { fontSize: 15, fontWeight: '600', color: colors.text },
  date: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  menuButton: { padding: spacing.xs },
  emptyBox: { alignItems: 'center', marginTop: spacing.xl * 2 },
  empty: { textAlign: 'center', color: colors.textLight, marginTop: spacing.md, fontWeight: '600' },
  emptySub: { color: colors.textLight, fontSize: 13, marginTop: 4, textAlign: 'center' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: colors.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: spacing.md, paddingBottom: spacing.xl },
  menuAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  menuActionText: { fontSize: 15, color: colors.text, marginLeft: spacing.sm },
});