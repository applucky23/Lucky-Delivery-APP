import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect personal information you provide when registering, such as your name, phone number, and email address. We also collect location data to facilitate task assignments and delivery services, as well as usage data to improve our platform.',
  },
  {
    title: '2. How We Use Your Information',
    body: 'Your information is used to process and fulfill service requests, communicate updates about your tasks, improve app performance, and ensure the safety and security of all users on the platform.',
  },
  {
    title: '3. Data Sharing',
    body: 'We do not sell your personal data to third parties. We may share necessary information with assigned workers to complete your requests. All data sharing is governed by strict confidentiality agreements.',
  },
  {
    title: '4. Data Security',
    body: 'We implement industry-standard security measures including encryption and secure servers to protect your personal information from unauthorized access, alteration, or disclosure.',
  },
  {
    title: '5. Your Rights',
    body: 'You have the right to access, update, or delete your personal information at any time through your profile settings or by contacting our support team. You may also opt out of non-essential communications.',
  },
  {
    title: '6. Changes to This Policy',
    body: 'We may update this Privacy Policy from time to time. We will notify you of significant changes via the app or email. Continued use of the app after changes constitutes acceptance of the updated policy.',
  },
];

const PrivacyScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.updated}>Last updated: April 2025</Text>
        <Text style={s.intro}>
          At Lucky, we are committed to protecting your privacy. This policy explains how we
          collect, use, and safeguard your personal information when you use our services.
        </Text>
        {SECTIONS.map((sec) => (
          <View key={sec.title} style={s.section}>
            <Text style={s.sectionTitle}>{sec.title}</Text>
            <Text style={s.sectionBody}>{sec.body}</Text>
          </View>
        ))}
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
  scroll: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  updated: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  intro: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  sectionBody: { fontSize: 14, color: '#6B7280', lineHeight: 22 },
});

export default PrivacyScreen;
