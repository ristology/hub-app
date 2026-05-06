import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email dan password wajib diisi.');
      return;
    }

    try {
      const deviceName = `${Platform.OS}-${Date.now()}`;
      await login(email.trim(), password, deviceName);
    } catch (e: any) {
      const msg = e.response?.data?.message ?? 'Gagal login. Coba lagi.';
      Alert.alert('Login Gagal', msg);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={styles.brand}>Afresto HUB</Text>
          <Text style={styles.subtitle}>Login untuk melanjutkan</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Masuk</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  flex:      { flex: 1 },
  content:   { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  brand: {
    color: '#fff', fontSize: 32, fontWeight: 'bold',
    textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    color: '#8a94a6', fontSize: 14,
    textAlign: 'center', marginBottom: 40,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14, borderRadius: 12,
    marginTop: 12, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
