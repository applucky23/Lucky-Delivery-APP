import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGES = [
  { code: 'en', name: 'English', subtitle: 'English (US)' },
  { code: 'am', name: 'Amharic', subtitle: 'አማርኛ' },
];

const STORAGE_KEY = '@lucky_language';

const LanguageScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState('en');

  // Load saved language on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) setSelected(val);
    });
  }, []);

  const handleSelect = async (code) => {
    setSelected(code);
    await AsyncStorage.setItem(STORAGE_KEY, code);
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.scroll}>
        <Text style={s.sectionTitle}>Select Language</Text>
        <View style={s.card}>
          {LANGUAGES.map((lang, i) => {
            const isSelected = selected === lang.code;
            const isLast = i === LANGUAGES.length - 1;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[s.row, !isLast && s.rowBorder, isSelected && s.rowActive]}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.7}
              >
                <View style={s.langInfo}>
                  <Text style={[s.langName, isSelected && s.langNameActive]}>
                    {lang.name}
                  </Text>
                  <Text style={s.langSub}>{lang.subtitle}</Text>
                </View>
                {isSelected && (
                  <MaterialIcons name="check-circle" size={22} color="#16A34A" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
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
  scroll: { paddingHorizontal: 16, paddingTop: 24, gap: 10 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  rowActive: { backgroundColor: '#F0FDF4' },
  langInfo: { flex: 1 },
  langName: { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  langNameActive: { color: '#16A34A' },
  langSub: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
});

export default LanguageScreen;
