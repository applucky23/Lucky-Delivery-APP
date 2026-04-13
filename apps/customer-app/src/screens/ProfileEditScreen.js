import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const ProfileEditScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [name, setName]   = useState('Abebe Kebede');
  const [phone, setPhone] = useState('+251 911 234 567');
  const [email, setEmail] = useState('abebe.kebede@email.com');

  const handleUpdate = () => {
    Alert.alert('Updated', 'Your profile has been updated successfully.');
  };

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
            <Text style={s.avatarText}>AK</Text>
          </View>
          <TouchableOpacity style={s.changePhoto}>
            <Text style={s.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={s.card}>
          <Field label="Full Name" value={name} onChange={setName}
            icon="person-outline" placeholder="Your full name" />
          <Field label="Phone Number" value={phone} onChange={setPhone}
            icon="phone" placeholder="+251 9XX XXX XXX" keyboardType="phone-pad" last />
        </View>

        <View style={s.card}>
          <Field label="Email Address" value={email} onChange={setEmail}
            icon="mail-outline" placeholder="your@email.com" keyboardType="email-address" last />
        </View>

        <TouchableOpacity style={s.updateBtn} onPress={handleUpdate} activeOpacity={0.85}>
          <Text style={s.updateBtnText}>Update Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const Field = ({ label, value, onChange, icon, placeholder, keyboardType, last }) => (
  <View style={[f.wrap, !last && f.border]}>
    <Text style={f.label}>{label}</Text>
    <View style={f.inputRow}>
      <MaterialIcons name={icon} size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
      <TextInput
        style={f.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType || 'default'}
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
  avatarSection: { alignItems: 'center', marginBottom: 8, gap: 10 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  changePhoto: { paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#16A34A' },
  changePhotoText: { color: '#16A34A', fontSize: 13, fontWeight: '700' },
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
