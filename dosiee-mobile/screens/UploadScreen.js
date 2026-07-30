import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';

export default function UploadScreen({ navigation }) {
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [isHandwritten, setIsHandwritten] = useState(false);

  const uploadFile = async (fileAsset) => {
    setUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', {
      uri: fileAsset.uri,
      name: fileAsset.name || 'prescription.jpg',
      type: fileAsset.mimeType || 'image/jpeg',
    });
    formData.append('is_handwritten', isHandwritten ? 'true' : 'false');

    try {
      const response = await api.post('/prescriptions/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.detail || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission needed', 'Camera access is required');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) uploadFile({ uri: result.assets[0].uri, name: 'photo.jpg', mimeType: 'image/jpeg' });
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Permission needed', 'Gallery access is required');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled) uploadFile({ uri: result.assets[0].uri, name: 'photo.jpg', mimeType: 'image/jpeg' });
  };

  const pickPDF = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.assets?.length > 0) {
      const asset = result.assets[0];
      uploadFile({ uri: asset.uri, name: asset.name, mimeType: 'application/pdf' });
    }
  };

  const OptionButton = ({ icon, label, onPress }) => (
    <TouchableOpacity style={styles.option} onPress={onPress} disabled={uploading}>
      <Feather name={icon} size={22} color={colors.primary} />
      <Text style={styles.optionText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload Prescription</Text>
      <Text style={styles.subtitle}>Take a photo, choose from your gallery, or upload a PDF</Text>

      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => setIsHandwritten(!isHandwritten)}
        disabled={uploading}
      >
        <Feather name={isHandwritten ? 'check-square' : 'square'} size={20} color={colors.primary} />
        <Text style={styles.toggleText}>This prescription is handwritten</Text>
      </TouchableOpacity>

      <OptionButton icon="camera" label="Take Photo" onPress={pickFromCamera} />
      <OptionButton icon="image" label="Choose from Gallery" onPress={pickFromGallery} />
      <OptionButton icon="file-text" label="Choose PDF" onPress={pickPDF} />

      {uploading && <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: spacing.lg }} />}

      {result && (
        <View style={styles.resultBox}>
          <Feather name="check-circle" size={22} color={colors.success} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.resultText}>Upload successful</Text>
            <Text style={styles.resultSub}>Status: {result.status}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  toggleText: { fontSize: 14, color: colors.text },
  option: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadow,
  },
  optionText: { fontSize: 15, fontWeight: '500', color: colors.text, marginLeft: spacing.sm },
  resultBox: {
    marginTop: spacing.lg,
    backgroundColor: '#EAF7F5',
    borderRadius: 10,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: { fontWeight: '600', color: colors.text },
  resultSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
});