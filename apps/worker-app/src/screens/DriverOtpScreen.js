import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ScrollView, ActivityIndicator,
  SafeAreaView, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { verifyOTP, registerDriver, getDriverProfile, uploadImage } from '../services/driverService';

export default function DriverOtpScreen({ navigation, route }) {
  const phone      = route?.params?.phone || '';
  const signupData = route?.params?.signupData || null;

  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(120);
  const inputs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (text, index) => {
    const next = [...otp];
    next[index] = text;
    setOtp(next);
    if (text && index < 5) inputs[index + 1].current?.focus();
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0)
      inputs[index - 1].current?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    try {
      // Step 1: verify OTP with Supabase → get JWT
      await verifyOTP(phone, code);

      if (signupData) {
        // SIGNUP FLOW: upload images first (now authenticated), then register
        const uid = Date.now().toString();
        let id_image   = '';
        let face_image = '';

        try {
          if (signupData.idImageUri) {
            id_image = await uploadImage(signupData.idImageUri, 'driver-docs', `${uid}-id.jpg`);
          }
        } catch (uploadErr) {
          console.warn('[Upload] ID image failed:', uploadErr.message);
          // Continue without image — admin can request later
        }

        try {
          if (signupData.faceImageUri) {
            face_image = await uploadImage(signupData.faceImageUri, 'driver-docs', `${uid}-face.jpg`);
          }
        } catch (uploadErr) {
          console.warn('[Upload] Face image failed:', uploadErr.message);
        }

        console.log('[Register] id_image:', id_image, 'face_image:', face_image);

        const result = await registerDriver({
          full_name:    signupData.full_name,
          area:         signupData.area,
          vehicle_type: signupData.vehicle_type,
          email:        signupData.email,
          id_image,
          face_image,
        });

        console.log('[Register] result:', JSON.stringify(result));

        if (result?.driver) {
          navigation.reset({ index: 0, routes: [{ name: 'PendingApproval' }] });
        } else {
          Alert.alert('Error', result?.error || 'Registration failed. Please try again.');
        }
      } else {
        // LOGIN FLOW: check if driver has a profile and is approved
        const profile = await getDriverProfile();
        if (profile?.error) {
          // No profile found — not registered as driver
          Alert.alert(
            'Not Registered',
            'No driver account found for this number. Please sign up first.',
            [{ text: 'OK', onPress: () => navigation.navigate('DriverLogin') }]
          );
          return;
        }
        if (profile?.is_verified) {
          navigation.reset({ index: 0, routes: [{ name: 'DriverHome' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'PendingApproval' }] });
        }
      }
    } catch (err) {
      Alert.alert('Invalid OTP', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setOtp(['', '', '', '', '', '']);
    setCountdown(120);
    inputs[0].current?.focus();
  };

  const isComplete = otp.every(d => d !== '');

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.topRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color="#151c25" />
          </TouchableOpacity>
          <Text style={s.brandName}>Lucky Delivery</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={s.iconSection}>
          <View style={s.iconBox}>
            <MaterialIcons name="sms" size={40} color="#006e2f" />
          </View>
        </View>

        <View style={s.titleSection}>
          <Text style={s.title}>Verify Your Number</Text>
          <Text style={s.subtitle}>
            Enter the 6-digit code sent to{'\n'}
            <Text style={s.phoneHighlight}>{phone}</Text>
          </Text>
        </View>

        <View style={s.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={inputs[i]}
              style={[s.otpInput, digit && s.otpInputFilled]}
              value={digit}
              onChangeText={text => handleChange(text.slice(-1), i)}
              onKeyPress={e => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="·"
              placeholderTextColor="#9aaa99"
              textAlign="center"
            />
          ))}
        </View>

        <View style={s.resendRow}>
          {countdown > 0
            ? <Text style={s.resendTimer}>Resend code in {countdown}s</Text>
            : <Text style={s.resendTimer}>Didn't receive the code?</Text>
          }
          <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
            <Text style={[s.resendLink, countdown > 0 && { opacity: 0.4 }]}>Resend</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[s.btn, !isComplete && s.btnDisabled]}
          onPress={handleVerify}
          activeOpacity={0.85}
          disabled={!isComplete || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={s.btnText}>Verify & Continue</Text>
              <MaterialIcons name="check-circle" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </>
          )}
        </TouchableOpacity>
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
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  topRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 40,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontSize: 18, fontWeight: '600', color: PRIMARY },
  iconSection: { alignItems: 'center', marginBottom: 32 },
  iconBox: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center',
  },
  titleSection: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 24, fontWeight: '600', color: '#151c25', marginBottom: 10 },
  subtitle: { fontSize: 15, color: '#5c5f60', textAlign: 'center', lineHeight: 22 },
  phoneHighlight: { fontWeight: '700', color: '#151c25' },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 },
  otpInput: {
    width: 46, height: 56, borderRadius: 12,
    backgroundColor: SURFACE, fontSize: 22, fontWeight: '700',
    color: '#151c25', borderWidth: 2, borderColor: 'transparent',
  },
  otpInputFilled: { borderColor: PRIMARY_C, backgroundColor: '#dcfce7' },
  resendRow: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6, marginBottom: 32,
  },
  resendTimer: { fontSize: 14, color: '#5c5f60' },
  resendLink: { fontSize: 14, fontWeight: '700', color: PRIMARY },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: PRIMARY_C, borderRadius: 12, height: 56,
    shadowColor: PRIMARY_C, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 6,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
