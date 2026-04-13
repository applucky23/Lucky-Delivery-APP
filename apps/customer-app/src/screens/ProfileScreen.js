import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const MOCK_USER = {
  name: 'Abebe Kebede',
  phone: '+251 911 234 567',
  initials: 'AK',
};

// ── Reusable menu row ─────────────────────────────────────────────────────────
const MenuRow = ({ icon, label, onPress, last }) => (
  <TouchableOpacity style={[row.wrap, !last && row.border]} onPress={onPress} activeOpacity={0.6}>
    <View style={row.iconBox}>
      <MaterialIcons name={icon} size={20} color="#16A34A" />
    </View>
    <Text style={row.label}>{label}</Text>
    <MaterialIcons name="chevron-right" size={22} color="#D1D5DB" />
  </TouchableOpacity>
);
const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 15, paddingHorizontal: 16, gap: 14,
  },
  border: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },
  label: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
});

// ── Section card wrapper ──────────────────────────────────────────────────────
const SectionCard = ({ title, children }) => (
  <View style={s.section}>
    <Text style={s.sectionTitle}>{title}</Text>
    <View style={s.card}>{children}</View>
  </View>
);

// ── Screen ────────────────────────────────────────────────────────────────────
const ProfileScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const go = (screen) => navigation.navigate(screen);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* User card */}
        <TouchableOpacity style={s.userCard} activeOpacity={0.8} onPress={() => go('ProfileEdit')}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{MOCK_USER.initials}</Text>
          </View>
          <View style={s.userInfo}>
            <Text style={s.userName}>{MOCK_USER.name}</Text>
            <Text style={s.userPhone}>{MOCK_USER.phone}</Text>
          </View>
          <View style={s.editBadge}>
            <MaterialIcons name="edit" size={16} color="#16A34A" />
          </View>
        </TouchableOpacity>

        {/* Account */}
        <SectionCard title="Account">
          <MenuRow icon="person-outline"   label="Profile"  onPress={() => go('ProfileEdit')} />
          <MenuRow icon="account-balance-wallet" label="Wallet" onPress={() => go('Wallet')} />
          <MenuRow icon="local-offer"      label="Coupon"   onPress={() => go('Coupon')} last />
        </SectionCard>

        {/* Support & Info */}
        <SectionCard title="Support & Info">
          <MenuRow icon="headset-mic"      label="Help & Support"   onPress={() => go('Help')} />
          <MenuRow icon="privacy-tip"      label="Privacy Policy"   onPress={() => go('Privacy')} />
          <MenuRow icon="description"      label="Terms & Reference" onPress={() => go('Terms')} last />
        </SectionCard>

        {/* Logout */}
        <View style={s.logoutSection}>
          <TouchableOpacity style={s.logoutBtn} activeOpacity={0.7}>
            <MaterialIcons name="logout" size={18} color="#EF4444" />
            <Text style={s.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={[s.bottomNav, { paddingBottom: insets.bottom || 15 }]}>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialIcons name="home" size={28} color="#6B7280" />
          <Text style={s.navText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('TaskList')}>
          <MaterialIcons name="assignment" size={26} color="#6B7280" />
          <Text style={s.navText}>TASKS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}>
          <MaterialIcons name="person" size={28} color="#16A34A" />
          <Text style={[s.navText, { color: '#16A34A' }]}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    paddingHorizontal: 20, height: 60, justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },

  // User card
  userCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  userInfo: { flex: 1 },
  userName: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 3 },
  userPhone: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  editBadge: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },

  // Section
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    overflow: 'hidden',
  },

  // Logout
  logoutSection: { paddingVertical: 8 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 15, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },

  // Bottom nav
  bottomNav: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: 'white', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center', height: 80,
    borderTopWidth: 1, borderTopColor: '#f1f3ff',
    elevation: 20, shadowColor: '#141b2b',
    shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.06, shadowRadius: 32,
  },
  navItem: { alignItems: 'center', paddingTop: 12 },
  navText: { fontSize: 11, fontWeight: '700', marginTop: 4, color: '#6B7280' },
});

export default ProfileScreen;
