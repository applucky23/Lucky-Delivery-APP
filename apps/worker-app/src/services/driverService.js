import { supabase } from './supabaseClient';

const DJANGO_URL = 'https://a303-196-189-145-165.ngrok-free.app/api/v1';

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
  // Try in-memory session first (fastest, no SecureStore read delay)
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

// Accepts an optional token to use directly (avoids SecureStore read race after OTP verify)
const apiCall = async (method, path, body = null, directToken = null) => {
  await checkNetwork();

  const token = directToken ?? await getToken();
  if (!token) throw new Error('Session expired. Please log in again.');

  let res;
  try {
    res = await fetch(`${DJANGO_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '1',
        'User-Agent': 'LuckyApp/1.0',
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

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('[apiCall] Non-JSON response:', res.status, text.slice(0, 200));
    throw new Error(`Server error (${res.status}). Please try again.`);
  }
};

export const registerDriver   = (data, token)  => apiCall('POST', '/driver/register/', data, token);
export const getDriverProfile = (token = null) => apiCall('GET',  '/driver/profile/', null, token);

// ── Task API ──────────────────────────────────────────────────────────────────

export const getDriverAssignments = () => apiCall('GET', '/tasks/driver/assignments/');
export const acceptTask           = (taskId) => apiCall('POST', `/tasks/${taskId}/accept/`);
export const rejectTask           = (taskId) => apiCall('POST', `/tasks/${taskId}/reject/`);
export const getTaskDetail        = (taskId) => apiCall('GET',  `/tasks/${taskId}/`);
export const getActiveTask        = () => apiCall('GET', '/tasks/driver/active/');
export const updateDriverProfile  = (data)   => apiCall('PATCH', '/driver/profile/update/', data);

// ── Task status transitions ───────────────────────────────────────────────────
export const updateTaskStatus = (taskId, data) => apiCall('PATCH', `/tasks/${taskId}/update/`, data);
export const transitionTask   = (taskId, action) => apiCall('POST', `/tasks/${taskId}/transition/`, { action });

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
