import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut } from '../services/driverService';

export default function DriverHomeScreen({ navigation }) {
  const handleSignOut = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'DriverLogin' }] });
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
      <View style={s.content}>
        <View style={s.iconBox}>
          <MaterialIcons name="check-circle" size={64} color="#22c55e" />
        </View>
        <Text style={s.title}>You're Approved! 🎉</Text>
        <Text style={s.subtitle}>Welcome to Lucky Delivery. Driver home screen coming soon.</Text>
      </View>
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}>
        <MaterialIcons name="logout" size={18} color="#ef4444" />
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  iconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#151c25', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5c5f60', textAlign: 'center' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 24, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#fee2e2', backgroundColor: '#fff5f5' },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});
