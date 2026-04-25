import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getProfile, updateProfile, getCustomer, saveCustomerName } from '../services/authService';

const ProfileEditScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProfile();
        if (data?.name !== undefined) {
          setName(data.name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
        } else {
          const customer = await getCustomer();
          if (customer) {
            setName(customer.name || '');
            setPhone(customer.phone || '');
          }
        }
      } catch (_) {}
    };
    load();
  }, []);

  const handleUpdate = async () => {
    if (!name.trim()) { Alert.alert('Required', 'Name cannot be empty.'); return; }
    setLoading(true);
    try {
      const result = await updateProfile({ name: name.trim(), email: email.trim() });
      if (result?.name) {
        await saveCustomerName(result.name);
        Alert.alert('Updated', 'Your profile has been updated.', [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error', result?.detail || 'Failed to update profile.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        </View>

        {/* Form */}
        <View style={s.card}>
          <Field label="Full Name" value={name} onChange={setName}
            icon="person-outline" placeholder="Your full name" />
          <Field label="Email" value={email} onChange={setEmail}
            icon="mail-outline" placeholder="your@email.com"
            keyboardType="email-address" last />
        </View>

        {/* Phone — read only */}
        <View style={s.card}>
          <Field label="Phone Number (cannot be changed)" value={phone} onChange={() => {}}
            icon="phone" placeholder="" editable={false} last />
        </View>

        <TouchableOpacity style={s.updateBtn} onPress={handleUpdate} activeOpacity={0.85} disabled={loading}>
          <Text style={s.updateBtnText}>{loading ? 'Saving...' : 'Update Profile'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const Field = ({ label, value, onChange, icon, placeholder, keyboardType, last, editable = true }) => (
  <View style={[f.wrap, !last && f.border]}>
    <Text style={f.label}>{label}</Text>
    <View style={f.inputRow}>
      <MaterialIcons name={icon} size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
      <TextInput
        style={[f.input, !editable && { color: '#9CA3AF' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
        editable={editable}
      />
    </View>
  </View>
);

const f = StyleSheet.create({
  wrap: { paddingVertical: 14, paddingHorizontal: 16 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, fontSize: 15, fontWeight: '500', color: '#111827' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingTop: 24, gap: 16 },
  avatarSection: { alignItems: 'center', marginBottom: 8 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden',
  },
  updateBtn: {
    backgroundColor: '#16A34A', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 8,
  },
  updateBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default ProfileEditScreen;
