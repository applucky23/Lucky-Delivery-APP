import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL      = 'https://uaxyknkvxgbshrqbvdcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheHlrbmt2eGdic2hycWJ2ZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjcwMTYsImV4cCI6MjA5MTg0MzAxNn0.20z9euNF9Yc3lTu3XNYpHaK3PbOUU8-x9rGpG_kNFwM';

// SecureStore adapter for Supabase — works in Expo Go (unlike AsyncStorage native module)
const ExpoSecureStoreAdapter = {
  getItem:    (key) => SecureStore.getItemAsync(key),
  setItem:    (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:            ExpoSecureStoreAdapter,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
