import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../store/auth';

export default function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Halo,</Text>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>
            {user?.role?.toUpperCase()} {user?.departemen ? `· ${user.departemen}` : ''}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phase 1 — Sukses Login!</Text>
          <Text style={styles.cardText}>
            Token tersimpan di SecureStore. Selanjutnya: Bottom Tab + modul Feed/Chat/Task/Kalender.
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1421' },
  content:   { padding: 24 },
  header:    { marginBottom: 32 },
  greeting:  { color: '#8a94a6', fontSize: 14 },
  name:      { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: 4 },
  role:      { color: '#3b82f6', fontSize: 12, marginTop: 4, fontWeight: '600' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14, padding: 20, marginBottom: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  cardText:  { color: '#c5cdd9', fontSize: 13, lineHeight: 20 },
  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)',
    paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#ef4444', fontWeight: '600' },
});
