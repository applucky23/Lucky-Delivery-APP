import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL      = 'https://uaxyknkvxgbshrqbvdcr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVheHlrbmt2eGdic2hycWJ2ZGNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjcwMTYsImV4cCI6MjA5MTg0MzAxNn0.20z9euNF9Yc3lTu3XNYpHaK3PbOUU8-x9rGpG_kNFwM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage:          AsyncStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
});
