import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen({ navigation }) {
  const [phone, setPhone] = useState('');

  const handleContinue = () => {
    if (phone.length >= 9) {
      navigation.navigate('Otp', { phone });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fb" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>Lucky</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branding */}
        <View style={styles.brandingSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>✦</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <Text style={styles.welcomeSubtitle}>Get anything done بسهولة</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          <Text style={styles.formLabel}>Enter your phone number to continue</Text>

          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.flag}>🇪🇹</Text>
              <Text style={styles.countryCodeText}>+251</Text>
            </View>
            <View style={styles.divider} />
            <TextInput
              style={styles.phoneInput}
              placeholder="911 00 00 00"
              placeholderTextColor="#9aaa99"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          <TouchableOpacity
            style={phone.length < 9 ? [styles.continueBtn, styles.continueBtnDisabled] : styles.continueBtn}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={styles.continueBtnText}>Continue  →</Text>
          </TouchableOpacity>

          <Text style={styles.smsNote}>
            We will send you a verification code via SMS
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
            <View style={styles.footerDot} />
            <Text style={styles.footerLink}>Terms of Service</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fb' },
  header: {
    height: 64,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  brandName: { fontSize: 20, fontWeight: '800', color: '#006b2c' },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  brandingSection: { alignItems: 'center', marginTop: 40, marginBottom: 48 },
  logoBox: {
    width: 96, height: 96, borderRadius: 20,
    backgroundColor: '#ffffff', alignItems: 'center',
    justifyContent: 'center', elevation: 4, marginBottom: 24,
  },
  logoIcon: { fontSize: 40, color: '#006b2c' },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: '#191c1e', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 14, fontWeight: '600', color: '#3e4a3d' },
  formSection: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#3e4a3d', textAlign: 'center', marginBottom: 16 },
  phoneInputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ffffff', borderRadius: 16,
    borderWidth: 1, borderColor: '#d0d8cf',
    height: 64, paddingHorizontal: 16, marginBottom: 16,
  },
  countryCode: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  flag: { fontSize: 20, marginRight: 8 },
  countryCodeText: { fontSize: 16, fontWeight: '700', color: '#191c1e' },
  divider: { width: 1, height: 28, backgroundColor: '#d0d8cf', marginRight: 12 },
  phoneInput: { flex: 1, fontSize: 18, fontWeight: '600', color: '#191c1e', letterSpacing: 2 },
  continueBtn: {
    height: 56, backgroundColor: '#006b2c', borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, marginTop: 8,
  },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  smsNote: { fontSize: 12, color: '#3e4a3d', textAlign: 'center', fontWeight: '500', paddingHorizontal: 32, marginTop: 12 },
  footer: { marginTop: 48, alignItems: 'center' },
  footerLinks: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  footerLink: { fontSize: 11, fontWeight: '700', color: '#6e7b6c', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 8 },
  footerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#bdcaba' },
  progressBar: { width: '100%', height: 4, backgroundColor: '#eceef0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { width: '33%', height: 4, backgroundColor: '#006b2c', borderRadius: 4 },
});
