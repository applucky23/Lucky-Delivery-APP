import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.218.173.1:8000/api/auth';

export const sendOTP = async (phone) => {
  const res = await fetch(`${BASE_URL}/send-otp/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.phone?.[0] || 'Failed to send OTP');
  return data; // { message, otp (dev), phone }
};

export const verifyOTP = async (phone, code) => {
  const res = await fetch(`${BASE_URL}/verify-otp/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Verification failed');
  return data; // { access, refresh, customer }
};

export const saveToken = async (access, refresh, customer) => {
  await AsyncStorage.multiSet([
    ['@lucky_access',   access],
    ['@lucky_refresh',  refresh],
    ['@lucky_customer', JSON.stringify(customer)],
  ]);
};

export const getToken = () => AsyncStorage.getItem('@lucky_access');

export const getCustomer = async () => {
  const raw = await AsyncStorage.getItem('@lucky_customer');
  return raw ? JSON.parse(raw) : null;
};

export const clearAuth = () =>
  AsyncStorage.multiRemove(['@lucky_access', '@lucky_refresh', '@lucky_customer']);
