import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut, getDriverProfile } from '../services/driverService';

export default function PendingApprovalScreen({ navigation }) {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getDriverProfile().then(p => setProfile(p)).catch(() => {});
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'DriverLogin' }] });
  };

  const isRejected = profile?.status === 'REJECTED';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      <View style={s.content}>
        {/* Icon */}
        <View style={[s.iconBox, isRejected && s.iconBoxRejected]}>
          <MaterialIcons
            name={isRejected ? 'cancel' : 'hourglass-top'}
            size={52}
            color={isRejected ? '#ef4444' : '#006e2f'}
          />
        </View>

        {/* Title */}
        <Text style={s.title}>
          {isRejected ? 'Application Rejected' : 'Application Under Review'}
        </Text>
        <Text style={s.subtitle}>
          {isRejected
            ? 'Unfortunately your driver application was not approved.'
            : 'Thank you for registering with Lucky Delivery. Our team is reviewing your documents and profile. You\'ll be notified once your account is approved.'
          }
        </Text>

        {/* Rejection reason */}
        {isRejected && profile?.rejection_reason ? (
          <View style={s.rejectionCard}>
            <Text style={s.rejectionLabel}>Reason:</Text>
            <Text style={s.rejectionText}>{profile.rejection_reason}</Text>
          </View>
        ) : null}

        {/* Status card — only for pending */}
        {!isRejected && (
          <View style={s.statusCard}>
            <View style={s.statusRow}>
              <MaterialIcons name="check-circle" size={20} color="#22c55e" />
              <Text style={s.statusText}>Phone verified</Text>
            </View>
            <View style={s.statusRow}>
              <MaterialIcons name="check-circle" size={20} color="#22c55e" />
              <Text style={s.statusText}>Profile submitted</Text>
            </View>
            <View style={s.statusRow}>
              <MaterialIcons name="schedule" size={20} color="#f59e0b" />
              <Text style={[s.statusText, { color: '#f59e0b' }]}>Admin verification pending</Text>
            </View>
          </View>
        )}

        {!isRejected && (
          <Text style={s.note}>
            Verification usually takes 1–2 business days. Contact support if you have questions.
          </Text>
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <MaterialIcons name="logout" size={18} color="#ef4444" />
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9ff' },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 20,
  },
  iconBox: {
    width: 96, height: 96, borderRadius: 24,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  iconBoxRejected: { backgroundColor: '#fee2e2' },
  title: { fontSize: 22, fontWeight: '700', color: '#151c25', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#5c5f60', textAlign: 'center', lineHeight: 22 },

  statusCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 14, fontWeight: '500', color: '#151c25' },

  note: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },

  rejectionCard: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 16,
    width: '100%', borderLeftWidth: 3, borderLeftColor: '#ef4444',
  },
  rejectionLabel: { fontSize: 12, fontWeight: '700', color: '#ef4444', marginBottom: 4 },
  rejectionText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, margin: 24, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#fee2e2', backgroundColor: '#fff5f5',
  },
  signOutText: { fontSize: 14, fontWeight: '700', color: '#ef4444' },
});
