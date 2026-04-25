import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyOTP, saveCustomerName, sendOTP } from '../services/authService';

export default function OtpScreen({ navigation, route }) {
  const phone = route?.params?.phone || '';
  const [otp, setOtp]             = useState(['', '', '', '', '', '']);
  const [loading, setLoading]     = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) {
      inputs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs[index - 1].current?.focus();
    }
  };

  const handleConfirm = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);
    try {
      await verifyOTP(phone, code);
      // Supabase session is now active — navigate forward
      navigation.navigate('PersonalDetail');
    } catch (err) {
      Alert.alert('Invalid OTP', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOTP(phone);
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      inputs[0].current?.focus();
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const isComplete = otp.every(d => d !== '');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f7f9fb" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.brandName}>Lucky</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconSection}>
          <View style={styles.iconBox}>
            <Text style={styles.iconEmoji}>🛡️</Text>
          </View>
          <View style={styles.iconBadge}>
            <Text style={styles.iconBadgeEmoji}>💬</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>Verify Code</Text>
          <Text style={styles.subtitle}>
            Enter the code sent to your phone{' '}
            <Text style={styles.phoneHighlight}>+251 {phone}</Text>
          </Text>
        </View>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={inputs[index]}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={text => handleChange(text.slice(-1), index)}
              onKeyPress={e => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="•"
              placeholderTextColor="#9aaa99"
              textAlign="center"
            />
          ))}
        </View>

        {/* Resend */}
        <View style={styles.resendSection}>
          {countdown > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {countdown}s</Text>
          ) : (
            <Text style={styles.resendTimer}>Didn't receive the code?</Text>
          )}
          <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
            <Text style={[styles.resendBtn, countdown > 0 && { opacity: 0.4 }]}>
              Resend Code
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={isComplete ? styles.confirmBtn : [styles.confirmBtn, styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmBtnText}>Confirm  ›</Text>
          }
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footerText}>SECURE ENCRYPTED VERIFICATION</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  header: {
    height: 64,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eceef0',
  },
  backArrow: {
    fontSize: 20,
    color: '#006b2c',
    fontWeight: '700',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#006b2c',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  iconSection: {
    marginBottom: 48,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 96,
    height: 96,
    backgroundColor: '#baecbc',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 44,
  },
  iconBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 40,
    height: 40,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconBadgeEmoji: {
    fontSize: 20,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#191c1e',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#3e4a3d',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  phoneHighlight: {
    fontWeight: '700',
    color: '#191c1e',
  },
  otpRow: {
    flexDirection: 'row',
    marginBottom: 40,
    gap: 8,
  },
  otpInput: {
    width: 44,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#d0d8cf',
    fontSize: 20,
    fontWeight: '700',
    color: '#191c1e',
    elevation: 1,
  },
  otpInputFilled: {
    borderColor: '#006b2c',
  },
  resendSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  resendTimer: {
    fontSize: 14,
    color: '#3e4a3d',
    fontWeight: '500',
    marginBottom: 8,
  },
  resendBtn: {
    fontSize: 14,
    fontWeight: '700',
    color: '#006b2c',
    opacity: 0.5,
  },
  confirmBtn: {
    width: '100%',
    height: 56,
    backgroundColor: '#006b2c',
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#006b2c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    marginBottom: 32,
  },
  confirmBtnDisabled: {
    opacity: 0.5,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6e7b6c',
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});
