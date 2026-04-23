import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCustomerName } from '../services/authService';

export default function PersonalDetailScreen({ navigation }) {
  const [fullName, setFullName] = useState('');

  const handleContinue = async () => {
    if (fullName.trim().length === 0) return;
    await saveCustomerName(fullName.trim());
    navigation.navigate('Home', { name: fullName.trim() });
  };

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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.titleSection}>
            <Text style={styles.sectionLabel}>Personal Details</Text>
            <Text style={styles.title}>What's your name?</Text>
          </View>

          {/* Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9aaa99"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.inputHint}>
              You can change this later in your profile settings.
            </Text>
          </View>

          {/* Continue Button */}
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={fullName.trim().length === 0 ? [styles.continueBtn, styles.continueBtnDisabled] : styles.continueBtn}
              onPress={handleContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue  →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom progress bar */}
      <View style={styles.progressBar}>
        <View style={styles.progressFill} />
      </View>
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
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  titleSection: {
    marginBottom: 48,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#006b2c',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#191c1e',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  inputSection: {
    marginBottom: 48,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3e4a3d',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  input: {
    height: 64,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontSize: 17,
    fontWeight: '500',
    color: '#191c1e',
    borderWidth: 1,
    borderColor: '#d0d8cf',
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: '#6e7b6c',
    marginLeft: 4,
  },
  actionSection: {
    marginTop: 'auto',
  },
  continueBtn: {
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
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#eceef0',
    width: '100%',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#006b2c',
    width: '100%',
  },
});
