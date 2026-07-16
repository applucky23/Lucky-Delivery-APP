import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { signOut, getDriverProfile, updateDriverProfile, getDriverRatings } from '../services/driverService';

const C = {
  primary: '#006e2f', primaryC: '#22c55e', onPrimaryC: '#004b1e',
  bg: '#f8f9fa', surface: '#ffffff', surfaceC: '#edeeef',
  surfaceCL: '#f3f4f5', surfaceCH: '#e7e8e9',
  onSurface: '#191c1d', onSurfaceV: '#3d4a3d',
  outline: '#6d7b6c', outlineV: '#bccbb9',
  tertiary: '#005ac2', tertiaryC: '#82abff',
  secondaryC: '#dae2fd', error: '#ba1a1a', errorC: '#ffdad6',
};

const VEHICLE_ICONS = {
  MOTORCYCLE: 'two-wheeler', BICYCLE: 'directions-bike',
  CAR: 'directions-car', MINI_TRUCK: 'local-shipping', ON_FOOT: 'directions-walk',
};

export default function DriverProfileScreen({ navigation }) {
  const [profile, setProfile]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [editing, setEditing]     = useState(false);
  const [form, setForm]           = useState({ full_name: '', area: '' });
  const [ratings, setRatings]     = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, ratingData] = await Promise.all([
          getDriverProfile(),
          getDriverRatings(),
        ]);
        if (data?.id) {
          setProfile(data);
          setForm({ full_name: data.full_name || '', area: data.area || '' });
        }
        if (ratingData) setRatings(ratingData);
      } catch (err) {
        console.warn('[Profile] load:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateDriverProfile(form);
      if (updated?.id) {
        setProfile(updated);
        setEditing(false);
        Alert.alert('Saved', 'Profile updated successfully.');
      } else {
        Alert.alert('Error', updated?.error || 'Could not save changes.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await signOut();
        navigation.reset({ index: 0, routes: [{ name: 'DriverLogin' }] });
      }},
    ]);
  };

  const vehicleIcon = VEHICLE_ICONS[profile?.vehicle_type] || 'directions-bike';

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.headerTitle}>My Profile</Text>
        <TouchableOpacity style={s.iconBtn} onPress={() => setEditing(!editing)}>
          <MaterialIcons name={editing ? 'close' : 'edit'} size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.primaryC} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 110 }]}>

          {/* Avatar */}
          <View style={s.heroSection}>
            <View style={s.avatarWrap}>
              <View style={s.avatarGradient}>
                <View style={s.avatarInner}>
                  <MaterialIcons name="person" size={52} color={C.primary} />
                </View>
              </View>
              {profile?.is_verified && (
                <View style={s.verifiedBadge}>
                  <MaterialIcons name="verified" size={18} color="#fff" />
                </View>
              )}
            </View>

            {editing ? (
              <TextInput
                style={s.nameInput}
                value={form.full_name}
                onChangeText={v => setForm(f => ({ ...f, full_name: v }))}
                placeholder="Full name"
                placeholderTextColor={C.outlineV}
              />
            ) : (
              <Text style={s.driverName}>{profile?.full_name || 'Driver'}</Text>
            )}

            <View style={s.infoChips}>
              <View style={s.chip}>
                <MaterialIcons name={vehicleIcon} size={16} color={C.primary} />
                <Text style={s.chipText}>{profile?.vehicle_type?.replace('_', ' ') || '—'}</Text>
              </View>
              <View style={s.chip}>
                <MaterialIcons name="phone" size={16} color={C.primary} />
                <Text style={s.chipText}>{profile?.phone || '—'}</Text>
              </View>
            </View>

            {/* Status badge */}
            <View style={[s.statusBadge, profile?.is_verified ? s.statusApproved : s.statusPending]}>
              <Text style={[s.statusText, { color: profile?.is_verified ? C.primary : '#7a5c00' }]}>
                {profile?.is_verified ? '✓ Approved' : '⏳ Pending Approval'}
              </Text>
            </View>
          </View>

          {/* Stats */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Total Tasks</Text>
              <Text style={s.statVal}>{profile?.total_tasks ?? 0}</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Rating</Text>
              <Text style={s.statVal}>
                {ratings?.rating_count > 0
                  ? `${ratings.average_rating.toFixed(1)} ★`
                  : '—'}
              </Text>
              {ratings?.rating_count > 0 && (
                <Text style={{ fontSize: 11, color: C.outline, marginTop: 2 }}>
                  {ratings.rating_count} review{ratings.rating_count !== 1 ? 's' : ''}
                </Text>
              )}
            </View>
            <View style={s.statCard}>
              <Text style={s.statLabel}>Status</Text>
              <Text style={[s.statVal, { color: profile?.is_online ? C.primary : C.outline }]}>
                {profile?.is_online ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>

          {/* Editable fields */}
          {editing && (
            <View style={s.editCard}>
              <Text style={s.editSectionLabel}>Edit Details</Text>
              <Text style={s.fieldLabel}>Area / Sub-city</Text>
              <TextInput
                style={s.fieldInput}
                value={form.area}
                onChangeText={v => setForm(f => ({ ...f, area: v }))}
                placeholder="e.g. Bole, Kirkos"
                placeholderTextColor={C.outlineV}
              />
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.saveBtnText}>Save Changes</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Info card */}
          {!editing && (
            <View style={s.infoCard}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Area</Text>
                <Text style={s.infoValue}>{profile?.area || '—'}</Text>
              </View>
              <View style={s.infoDivider} />
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Email</Text>
                <Text style={s.infoValue}>{profile?.email || '—'}</Text>
              </View>
              <View style={s.infoDivider} />
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Vehicle</Text>
                <Text style={s.infoValue}>{profile?.vehicle_type?.replace('_', ' ') || '—'}</Text>
              </View>
              <View style={s.infoDivider} />
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Member since</Text>
                <Text style={s.infoValue}>
                  {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* Logout */}
          <TouchableOpacity style={s.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <MaterialIcons name="logout" size={20} color={C.error} />
            <Text style={s.logoutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={s.footer}>Lucky Delivery • Driver v1.0</Text>
        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('DriverHome')}>
          <MaterialIcons name="home" size={22} color={C.onSurfaceV} />
          <Text style={s.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('DriverActiveTask')}>
          <MaterialIcons name="directions-run" size={22} color={C.onSurfaceV} />
          <Text style={s.navText}>Active Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItemActive}>
          <MaterialIcons name="person" size={22} color={C.onPrimaryC} />
          <Text style={s.navTextActive}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.primary },
  iconBtn:     { padding: 6 },
  loadingBox:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:      { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  heroSection:    { alignItems: 'center', paddingTop: 8, gap: 8 },
  avatarWrap:     { position: 'relative', marginBottom: 4 },
  avatarGradient: { width: 110, height: 110, borderRadius: 55, padding: 3, backgroundColor: C.primaryC },
  avatarInner:    { flex: 1, borderRadius: 52, backgroundColor: C.surfaceCL, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },
  verifiedBadge:  { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: C.surface },
  driverName:     { fontSize: 26, fontWeight: '800', color: C.onSurface },
  nameInput:      { fontSize: 22, fontWeight: '700', color: C.onSurface, borderBottomWidth: 2, borderBottomColor: C.primaryC, paddingBottom: 4, minWidth: 200, textAlign: 'center' },
  infoChips:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  chip:           { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surfaceCL, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  chipText:       { fontSize: 13, color: C.onSurfaceV, fontWeight: '500' },
  statusBadge:    { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  statusApproved: { backgroundColor: '#dcfce7' },
  statusPending:  { backgroundColor: '#fef9c3' },
  statusText:     { fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.outlineV + '30', elevation: 1 },
  statLabel:{ fontSize: 12, color: C.onSurfaceV, marginBottom: 6 },
  statVal:  { fontSize: 20, fontWeight: '700', color: C.primary },

  editCard:         { backgroundColor: C.surface, borderRadius: 16, padding: 16, gap: 10, elevation: 2 },
  editSectionLabel: { fontSize: 13, fontWeight: '700', color: C.outline, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  fieldLabel:       { fontSize: 13, fontWeight: '600', color: C.onSurfaceV },
  fieldInput:       { height: 48, backgroundColor: C.surfaceCL, borderRadius: 10, paddingHorizontal: 14, fontSize: 15, color: C.onSurface },
  saveBtn:          { height: 50, backgroundColor: C.primaryC, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveBtnText:      { fontSize: 15, fontWeight: '600', color: C.onPrimaryC },

  infoCard:   { backgroundColor: C.surface, borderRadius: 16, padding: 4, elevation: 1 },
  infoRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoDivider:{ height: 1, backgroundColor: C.outlineV + '30', marginHorizontal: 16 },
  infoLabel:  { fontSize: 14, color: C.onSurfaceV },
  infoValue:  { fontSize: 14, fontWeight: '600', color: C.onSurface },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, backgroundColor: C.errorC, borderRadius: 14 },
  logoutText: { fontSize: 16, fontWeight: '600', color: C.error },
  footer:     { textAlign: 'center', fontSize: 12, color: C.outline },

  bottomNav:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: C.surface, paddingTop: 10, paddingBottom: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
  navItemActive: { flexDirection: 'column', alignItems: 'center', backgroundColor: C.primaryC, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 30, gap: 2 },
  navItem:       { flexDirection: 'column', alignItems: 'center', padding: 8, gap: 2 },
  navTextActive: { fontSize: 11, fontWeight: '600', color: C.onPrimaryC },
  navText:       { fontSize: 11, fontWeight: '500', color: C.onSurfaceV },
});
