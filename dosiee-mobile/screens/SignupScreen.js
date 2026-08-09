import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, shadow } from '../theme';
import { getErrorMessage } from '../utils/errorMessage';

const GENDERS = ['Male', 'Female', 'Other'];

export default function SignupScreen({ navigation }) {
  const { setToken, setUserEmail } = useAuth();
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignup = async () => {
    setError('');
    if (!fullName || !age || !gender || !phone || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/signup', {
        email, password, full_name: fullName, age: parseInt(age), gender, phone,
      });
      await setToken(res.data.access_token);
      await setUserEmail(email);
      // No navigation call needed — App.js switches to the main app
      // automatically once a token is present.
    } catch (err) {
      setError(getErrorMessage(err, 'Signup failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}>
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Track and manage medicines with ease</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="e.g. Priya Sharma" placeholderTextColor={colors.textLight} />

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <Text style={styles.label}>Age</Text>
          <TextInput style={styles.input} value={age} onChangeText={setAge} placeholder="e.g. 45" keyboardType="numeric" placeholderTextColor={colors.textLight} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="e.g. 9876543210" keyboardType="phone-pad" placeholderTextColor={colors.textLight} />
        </View>
      </View>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {GENDERS.map((g) => (
          <TouchableOpacity key={g} style={[styles.genderOption, gender === g && styles.genderOptionActive]} onPress={() => setGender(g)}>
            <Text style={[styles.genderText, gender === g && styles.genderTextActive]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Email</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.textLight} />

      <Text style={styles.label}>Password</Text>
      <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Create a password" placeholderTextColor={colors.textLight} />

      <Text style={styles.label}>Confirm Password</Text>
      <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Re-enter your password" placeholderTextColor={colors.textLight} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Creating account...' : 'Sign Up'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an account? Log in</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 26, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg },
  label: { fontSize: 12, color: colors.textLight, marginBottom: 4, marginTop: spacing.sm },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: spacing.md, fontSize: 15, color: colors.text },
  row: { flexDirection: 'row' },
  genderRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  genderOption: { flex: 1, paddingVertical: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.card },
  genderOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { color: colors.textLight, fontSize: 13, fontWeight: '600' },
  genderTextActive: { color: '#fff' },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: spacing.md, alignItems: 'center', marginTop: spacing.lg, ...shadow },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', marginTop: spacing.lg, marginBottom: spacing.xl, fontSize: 14 },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: 13 },
});