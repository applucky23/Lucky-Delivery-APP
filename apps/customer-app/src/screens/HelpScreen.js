import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const SUPPORT = [
  { icon: 'location-on',  label: 'Address',  value: 'Bole Road, Addis Ababa, Ethiopia',  action: null },
  { icon: 'phone',        label: 'Call Us',   value: '+251 911 000 000',                  action: () => Linking.openURL('tel:+251911000000') },
  { icon: 'mail-outline', label: 'Email',     value: 'support@applucky.et',               action: () => Linking.openURL('mailto:support@applucky.et') },
  { icon: 'send',         label: 'Telegram',  value: '@applucky',                         action: () => Linking.openURL('https://t.me/applucky') },
];

const HelpScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Support contacts */}
        <Text style={s.sectionTitle}>Contact Us</Text>
        <View style={s.card}>
          {SUPPORT.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[s.row, i < SUPPORT.length - 1 && s.rowBorder]}
              onPress={item.action}
              activeOpacity={item.action ? 0.6 : 1}
            >
              <View style={s.iconBox}>
                <MaterialIcons name={item.icon} size={18} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowLabel}>{item.label}</Text>
                <Text style={s.rowValue}>{item.value}</Text>
              </View>
              {item.action && <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={s.sectionTitle}>About Support</Text>
        <View style={s.card}>
          <Text style={s.paragraph}>
            Our support team is available every day from 8:00 AM to 10:00 PM (EAT) to assist you
            with any questions, issues, or feedback regarding your orders and account.{'\n\n'}
            For urgent matters, we recommend reaching out via phone or Telegram for the fastest
            response. Email inquiries are typically answered within 24 hours.{'\n\n'}
            Whether you need help tracking a task, resolving a payment issue, or understanding
            how our services work, we're here to make your experience as smooth as possible.
          </Text>
        </View>

        {/* Extra buttons */}
        <Text style={s.sectionTitle}>Legal</Text>
        <View style={s.card}>
          <TouchableOpacity
            style={[s.row, s.rowBorder]}
            onPress={() => navigation.navigate('Privacy')}
            activeOpacity={0.6}
          >
            <View style={s.iconBox}>
              <MaterialIcons name="privacy-tip" size={18} color="#16A34A" />
            </View>
            <Text style={[s.rowValue, { flex: 1, fontWeight: '600' }]}>Privacy Policy</Text>
            <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.row}
            onPress={() => navigation.navigate('Terms')}
            activeOpacity={0.6}
          >
            <View style={s.iconBox}>
              <MaterialIcons name="description" size={18} color="#16A34A" />
            </View>
            <Text style={[s.rowValue, { flex: 1, fontWeight: '600' }]}>Terms & Reference</Text>
            <MaterialIcons name="chevron-right" size={20} color="#D1D5DB" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

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
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '500' },
  paragraph: { fontSize: 14, color: '#6B7280', lineHeight: 22, padding: 16 },
});

export default HelpScreen;
