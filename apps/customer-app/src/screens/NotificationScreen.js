import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getNotifications, markRead, markAllRead } from '../services/authService';
import { useNotifCount } from '../contexts/RatingContext';

const TYPE_META = {
  TASK_ASSIGNED:  { icon: 'assignment',   color: '#2563EB' },
  TASK_COMPLETED: { icon: 'check-circle', color: '#16A34A' },
  PAYMENT_REQUIRED: { icon: 'payment',    color: '#F59E0B' },
  SYSTEM_ALERT:   { icon: 'warning',      color: '#DC2626' },
  PRICE_UPDATE:   { icon: 'attach-money', color: '#F59E0B' },
};
const DEFAULT_META = { icon: 'notifications', color: '#6B7280' };

export default function NotificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { refresh: refreshUnread } = useNotifCount();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications();
      if (Array.isArray(data)) setNotifs(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (n) => {
    if (!n.is_read) {
      try { await markRead(n.id); } catch {}
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      refreshUnread();
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setNotifs(prev => prev.map(x => ({ ...x, is_read: true })));
      refreshUnread();
    } catch {}
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAll}>
            <Text style={s.markAll}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      ) : notifs.length === 0 ? (
        <View style={s.center}>
          <MaterialIcons name="notifications-none" size={52} color="#D1D5DB" />
          <Text style={s.emptyTitle}>No notifications</Text>
          <Text style={s.emptySub}>You're all caught up!</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {notifs.map(n => {
            const meta = TYPE_META[n.type] || DEFAULT_META;
            return (
              <TouchableOpacity
                key={n.id}
                style={[s.row, !n.is_read && s.rowUnread]}
                onPress={() => handlePress(n)}
                activeOpacity={0.7}
              >
                <View style={[s.iconBox, { backgroundColor: meta.color + '18' }]}>
                  <MaterialIcons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowTitle, !n.is_read && s.rowTitleUnread]}>{n.title}</Text>
                  <Text style={s.rowMsg} numberOfLines={2}>{n.message}</Text>
                  <Text style={s.rowTime}>{formatTime(n.created_at)}</Text>
                </View>
                {!n.is_read && <View style={s.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn:   { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1 },
  markAll:   { fontSize: 14, fontWeight: '600', color: '#16A34A' },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#6B7280' },
  emptySub:  { fontSize: 14, color: '#9CA3AF' },
  scroll:    { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', padding: 14, borderRadius: 14 },
  rowUnread: { backgroundColor: '#F0FDF4' },
  iconBox:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  rowTitleUnread: { color: '#16A34A' },
  rowMsg:    { fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 16 },
  rowTime:   { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
});
