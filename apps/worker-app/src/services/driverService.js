import { supabase } from './supabaseClient';

const DJANGO_URL = 'http://192.168.0.196:8000/api/v1';

// ── Network check helper ──────────────────────────────────────────────────────
const checkNetwork = async () => {
  try {
    await fetch('https://www.google.com', { method: 'HEAD', timeout: 3000 });
  } catch {
    throw new Error('No internet connection. Please check your network and try again.');
  }
};

// ── Auth helpers ──────────────────────────────────────────────────────────────

export const sendOTP = async (phone) => {
  await checkNetwork();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw new Error(error.message);
};

export const verifyOTP = async (phone, token) => {
  await checkNetwork();
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw new Error(error.message);
  return data;
};

export const getToken = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
};

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

// ── Django API ────────────────────────────────────────────────────────────────

const apiCall = async (method, path, body = null) => {
  await checkNetwork();

  const token = await getToken();
  if (!token) throw new Error('Session expired. Please log in again.');

  let res;
  try {
    res = await fetch(`${DJANGO_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the server. Please try again.');
  }

  // Handle expired/invalid token
  if (res.status === 401) {
    await supabase.auth.signOut();
    throw new Error('Session expired. Please log in again.');
  }

  return res.json();
};

export const registerDriver  = (data)  => apiCall('POST', '/driver/register/', data);
export const getDriverProfile = ()     => apiCall('GET',  '/driver/profile/');

// ── Supabase Storage image upload ─────────────────────────────────────────────

export const uploadImage = async (uri, bucket, fileName) => {
  await checkNetwork();

  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const arrayBuffer = await new Response(blob).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { error } = await supabase.storage
      .from(bucket)
      .upload(`drivers/${fileName}`, uint8Array, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw new Error(`Image upload failed: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(`drivers/${fileName}`);

    return urlData.publicUrl;
  } catch (err) {
    throw new Error(err.message || 'Image upload failed. Please try again.');
  }
};
