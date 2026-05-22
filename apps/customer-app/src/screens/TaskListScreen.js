import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getTasks } from '../services/authService';

// Backend status → display config
const STATUS_CONFIG = {
  PENDING:           { label: 'Pending',     color: '#6B7280', bg: '#F3F4F6' },
  ASSIGNED:          { label: 'Assigned',    color: '#2563EB', bg: '#EFF6FF' },
  ARRIVED:           { label: 'Arrived',     color: '#7C3AED', bg: '#F5F3FF' },
  AWAITING_APPROVAL: { label: 'Needs Approval', color: '#D97706', bg: '#FFFBEB' },
  PURCHASED:         { label: 'Purchased',   color: '#0891B2', bg: '#ECFEFF' },
  DELIVERING:        { label: 'Delivering',  color: '#EA580C', bg: '#FFF7ED' },
  COMPLETED:         { label: 'Completed',   color: '#16A34A', bg: '#F0FDF4' },
  CANCELLED:         { label: 'Cancelled',   color: '#DC2626', bg: '#FEF2F2' },
};

const TYPE_META = {
  DELIVERY: { icon: 'local-shipping', label: 'Pick & Drop' },
  SHOPPING: { icon: 'shopping-bag',   label: 'Buy Something' },
  ERRAND:   { icon: 'assignment',     label: 'Run Errand' },
};

const ACTIVE_STATUSES = ['PENDING', 'ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING'];

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  return (
    <View style={[badge.wrap, { backgroundColor: cfg.bg }]}>
      <Text style={[badge.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};
const badge = StyleSheet.create({
  wrap: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  text: { fontSize: 11, fontWeight: '700' },
});

const TaskCard = ({ task, onPress }) => {
  const meta = TYPE_META[task.type] || TYPE_META.ERRAND;
  const date = task.created_at ? new Date(task.created_at).toLocaleDateString() : '';
  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.75}>
      <View style={card.row}>
        <View style={card.iconBox}>
          <MaterialIcons name={meta.icon} size={20} color="#16A34A" />
        </View>
        <View style={card.info}>
          <Text style={card.type}>{meta.label}</Text>
          <Text style={card.desc} numberOfLines={1}>{task.note || '—'}</Text>
          <View style={card.meta}>
            <MaterialIcons name="schedule" size={12} color="#9CA3AF" />
            <Text style={card.date}>{date}</Text>
            {task.estimated_price ? (
              <Text style={card.price}>{task.estimated_price} ETB</Text>
            ) : null}
          </View>
        </View>
        <StatusBadge status={task.status} />
      </View>
    </TouchableOpacity>
  );
};
const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  type: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  desc: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  price: { fontSize: 11, color: '#16A34A', fontWeight: '700' },
});

const TaskListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getTasks();
      if (Array.isArray(data)) setTasks(data);
    } catch (err) {
      console.warn('[TaskList]', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const active = tasks.filter(t => ACTIVE_STATUSES.includes(t.status));
  const done   = tasks.filter(t => !ACTIVE_STATUSES.includes(t.status));

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>My Tasks</Text>
        {tasks.length > 0 && (
          <View style={s.headerBadge}>
            <Text style={s.headerBadgeText}>{tasks.length}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      ) : tasks.length === 0 ? (
        <View style={s.centerBox}>
          <MaterialIcons name="inbox" size={52} color="#D1D5DB" />
          <Text style={s.emptyTitle}>No tasks yet</Text>
          <Text style={s.emptySub}>Request a service from the home screen.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#16A34A']} />}
        >
          {active.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Active</Text>
              {active.map(t => (
                <TaskCard key={t.id} task={t}
                  onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })} />
              ))}
            </>
          )}
          {done.length > 0 && (
            <>
              <Text style={s.sectionLabel}>Completed / Cancelled</Text>
              {done.map(t => (
                <TaskCard key={t.id} task={t}
                  onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })} />
              ))}
            </>
          )}
        </ScrollView>
      )}

      <View style={[s.bottomNav, { paddingBottom: insets.bottom || 15 }]}>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialIcons name="home" size={28} color="#6B7280" />
          <Text style={s.navText}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem}>
          <MaterialIcons name="assignment" size={26} color="#16A34A" />
          <Text style={[s.navText, { color: '#16A34A' }]}>TASKS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('Profile')}>
          <MaterialIcons name="person" size={28} color="#6B7280" />
          <Text style={s.navText}>PROFILE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, height: 60, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerBadge: { backgroundColor: '#16A34A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 32 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  bottomNav: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#f9f9ff', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', height: 90, borderTopWidth: 1, borderTopColor: '#e8e8f0' },
  navItem: { alignItems: 'center', paddingTop: 16, marginBottom: 10 },
  navText: { fontSize: 11, fontWeight: '700', marginTop: 4, color: '#6B7280' },
});

export default TaskListScreen;
