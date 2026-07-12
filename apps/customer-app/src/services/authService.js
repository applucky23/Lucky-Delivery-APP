import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';

const DJANGO_URL = 'http://192.168.1.3:8000/api/v1';

// ── Supabase Phone OTP (via AfroMessage hook) ─────────────────────────────────

export const sendOTP = async (phone) => {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
  return { message: 'OTP sent via SMS.' };
};

export const verifyOTP = async (phone, token) => {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });
  if (error) throw new Error(error.message);
  return data; // { session: { access_token, refresh_token }, user }
};

// ── Session / token helpers ───────────────────────────────────────────────────

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
};

export const getToken = async () => {
  const session = await getSession();
  return session?.access_token ?? null;
};

export const saveCustomerName = async (name) => {
  const raw = await AsyncStorage.getItem('@lucky_customer');
  const customer = raw ? JSON.parse(raw) : {};
  customer.name = name;
  await AsyncStorage.setItem('@lucky_customer', JSON.stringify(customer));
};

export const getCustomer = async () => {
  // Prefer Supabase session user
  const session = await getSession();
  if (session?.user) {
    const raw = await AsyncStorage.getItem('@lucky_customer');
    const local = raw ? JSON.parse(raw) : {};
    return {
      id:    session.user.id,
      phone: session.user.phone || '',
      email: session.user.email || '',
      name:  local.name || '',
    };
  }
  return null;
};

export const clearAuth = async () => {
  await supabase.auth.signOut();
  await AsyncStorage.removeItem('@lucky_customer');
};

// ── Django API helpers ────────────────────────────────────────────────────────

export const apiGet = async (path) => {
  const token = await getToken();
  const res = await fetch(`${DJANGO_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'ngrok-skip-browser-warning': '1',
      'User-Agent': 'LuckyApp/1.0',
    },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    console.warn(`[API] Non-JSON from ${path}:`, res.status, text.slice(0, 100));
    throw new Error(`Server error (${res.status})`);
  }
};

export const apiPost = async (path, body) => {
  const token = await getToken();
  const res = await fetch(`${DJANGO_URL}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      'User-Agent': 'LuckyApp/1.0',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    console.warn(`[API] Non-JSON from ${path}:`, res.status, text.slice(0, 100));
    throw new Error(`Server error (${res.status})`);
  }
};

export const apiPut = async (path, body) => {
  const token = await getToken();
  const res = await fetch(`${DJANGO_URL}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '1',
      'User-Agent': 'LuckyApp/1.0',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch {
    console.warn(`[API] Non-JSON from ${path}:`, res.status, text.slice(0, 100));
    throw new Error(`Server error (${res.status})`);
  }
};

// ── Profile helpers ───────────────────────────────────────────────────────────

export const getProfile = async () => {
  const data = await apiGet('/profile/');
  // Cache for instant load next time
  if (data?.name !== undefined) {
    await AsyncStorage.setItem('@lucky_profile', JSON.stringify(data));
  }
  return data;
};

export const getCachedProfile = async () => {
  const raw = await AsyncStorage.getItem('@lucky_profile');
  return raw ? JSON.parse(raw) : null;
};

export const updateProfile = (data) => apiPut('/profile/', data);

// ── Task helpers ──────────────────────────────────────────────────────────────

export const getTasks     = ()         => apiGet('/tasks/');
export const getTask      = (id)       => apiGet(`/tasks/${id}/`);
export const cancelTask    = (id)       => apiPost(`/tasks/${id}/cancel/`, {});

// ── Rating ─────────────────────────────────────────────────────────────────────

export const rateTask       = (taskId, rating, comment) => apiPost(`/tasks/${taskId}/rate/`, { rating, comment });
export const getTaskRating  = (taskId) => apiGet(`/tasks/${taskId}/rate/`);

// ── Notifications ─────────────────────────────────────────────────────────────

export const getNotifications   = ()      => apiGet('/notifications/');
export const getUnreadCount     = ()      => apiGet('/notifications/unread-count/');
export const markRead           = (id)    => apiPost(`/notifications/${id}/read/`, {});
export const markAllRead        = ()      => apiPost('/notifications/read-all/', {});
