import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'By downloading, registering, or using the Lucky app, you agree to be bound by these Terms and Conditions. If you do not agree, please discontinue use of the application immediately.',
  },
  {
    title: '2. Service Description',
    body: 'Lucky is an on-demand concierge platform that connects customers with local workers to fulfill tasks including purchasing goods, pick-up and drop-off services, and running errands on their behalf.',
  },
  {
    title: '3. User Responsibilities',
    body: 'You are responsible for providing accurate task information, ensuring someone is available to receive deliveries, and treating workers with respect. Misuse of the platform, including fraudulent requests, may result in account suspension.',
  },
  {
    title: '4. Payments & Fees',
    body: 'Service fees are displayed before task confirmation. Lucky reserves the right to adjust pricing based on distance, task complexity, and demand. All payments are processed securely through the app.',
  },
  {
    title: '5. Cancellation Policy',
    body: 'Tasks may be cancelled before a worker is assigned at no charge. Cancellations after assignment may incur a partial fee to compensate the worker for their time and travel.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'Lucky acts as an intermediary platform and is not liable for damages resulting from worker actions, delays caused by third parties, or circumstances beyond our reasonable control including force majeure events.',
  },
  {
    title: '7. Modifications',
    body: 'We reserve the right to modify these terms at any time. Users will be notified of material changes. Continued use of the app following notification constitutes acceptance of the revised terms.',
  },
];

const TermsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms & Reference</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.updated}>Effective: April 2025</Text>
        <Text style={s.intro}>
          These Terms and Conditions govern your use of the Lucky platform. Please read them
          carefully before using our services.
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

export default TermsScreen;
