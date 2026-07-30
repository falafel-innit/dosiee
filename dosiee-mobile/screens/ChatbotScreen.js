import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export default function ChatbotScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assistant</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.iconCircle}>
          <Feather name="message-circle" size={36} color={colors.primary} />
        </View>
        <Text style={styles.message}>Chatbot coming soon</Text>
        <Text style={styles.sub}>This screen will let you ask questions about your medicines and prescriptions in a future update.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: '700', color: colors.text },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EAF7F5', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  message: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  sub: { fontSize: 13, color: colors.textLight, textAlign: 'center', lineHeight: 20 },
});