import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { sendOTP } from '../services/driverService';

export default function DriverLoginScreen({ navigation }) {
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);

  const isValid = phone.length >= 9;

  const handleSend = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const fullPhone = `+251${phone}`;
      await sendOTP(fullPhone);
      navigation.navigate('DriverOtp', { phone: fullPhone });
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* App Identity */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <MaterialIcons name="local-shipping" size={36} color="#006e2f" />
          </View>
          <Text style={s.brandName}>Lucky Delivery</Text>
        </View>

        {/* Welcome */}
        <View style={s.welcomeSection}>
          <Text style={s.welcomeTitle}>Welcome Back Driver</Text>
          <Text style={s.welcomeSubtitle}>Login with your phone number to continue</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <Text style={s.label}>Phone Number</Text>

          <View style={s.inputWrapper}>
            <View style={s.prefix}>
              <Text style={s.prefixText}>+251</Text>
              <View style={s.prefixDivider} />
            </View>
            <TextInput
              style={s.input}
              placeholder="912 345 678"
              placeholderTextColor="#9aaa99"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          {/* Security note */}
          <View style={s.securityNote}>
            <MaterialIcons name="shield" size={14} color="#5c5f60" />
            <Text style={s.securityText}>
              Your number is safe with us. We'll send a code to verify.
            </Text>
          </View>

          {/* Submit button */}
          <TouchableOpacity
            style={[s.btn, !isValid && s.btnDisabled]}
            onPress={handleSend}
            activeOpacity={0.85}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={s.btnText}>Send Verification Code</Text>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>

          {/* Create account link */}
          <View style={s.signupRow}>
            <Text style={s.signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('DriverSignup')}>
              <Text style={s.signupLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>By continuing, you agree to our</Text>
          <View style={s.footerLinks}>
            <TouchableOpacity><Text style={s.footerLink}>Terms of Service</Text></TouchableOpacity>
            <Text style={s.footerDot}> · </Text>
            <TouchableOpacity><Text style={s.footerLink}>Privacy Policy</Text></TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const PRIMARY   = '#006e2f';
const PRIMARY_C = '#22c55e';
const BG        = '#f8f9ff';
const SURFACE   = '#eef4ff';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1, paddingHorizontal: 24,
    paddingTop: 32, paddingBottom: 40,
    justifyContent: 'space-between',
  },

  // Header
  header: { alignItems: 'center', marginBottom: 48 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, marginBottom: 12,
  },
  brandName: { fontSize: 20, fontWeight: '600', color: PRIMARY, letterSpacing: 0.3 },

  // Welcome
  welcomeSection: { alignItems: 'center', marginBottom: 40 },
  welcomeTitle: { fontSize: 24, fontWeight: '600', color: '#151c25', marginBottom: 8 },
  welcomeSubtitle: { fontSize: 16, color: '#5c5f60', textAlign: 'center' },

  // Form
  form: { gap: 12 },
  label: {
    fontSize: 14, fontWeight: '600', color: '#3d4a3d',
    textAlign: 'center', letterSpacing: 0.2, marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SURFACE, borderRadius: 12,
    height: 56, overflow: 'hidden',
  },
  prefix: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 16, paddingRight: 12, height: '100%',
  },
  prefixText: { fontSize: 16, fontWeight: '700', color: '#151c25' },
  prefixDivider: {
    width: 1, height: 24, backgroundColor: '#bccbb9', marginLeft: 12,
  },
  input: {
    flex: 1, fontSize: 16, fontWeight: '500',
    color: '#151c25', paddingHorizontal: 12,
  },
  securityNote: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 4, marginTop: 4,
  },
  securityText: { fontSize: 12, color: '#5c5f60' },

  // Button
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY_C, borderRadius: 12, height: 56, marginTop: 8,
    shadowColor: PRIMARY_C, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Footer
  footer: { alignItems: 'center', marginTop: 48, gap: 4 },
  footerText: { fontSize: 12, color: '#5c5f60' },
  footerLinks: { flexDirection: 'row', alignItems: 'center' },
  footerLink: { fontSize: 12, fontWeight: '600', color: PRIMARY },
  footerDot: { fontSize: 12, color: '#5c5f60' },

  signupRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  signupText: { fontSize: 14, color: '#5c5f60' },
  signupLink: { fontSize: 14, fontWeight: '700', color: PRIMARY },
});
