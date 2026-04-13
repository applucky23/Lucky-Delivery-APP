import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MOCK_TASKS, STATUS_CONFIG } from '../data/mockTasks';

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
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

// ── Task Card ─────────────────────────────────────────────────────────────────
const TYPE_ICON = { buy: 'shopping-bag', pickup: 'local-shipping', errand: 'assignment' };

const TaskCard = ({ task, onPress }) => (
  <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.75}>
    <View style={card.row}>
      <View style={card.iconBox}>
        <MaterialIcons name={TYPE_ICON[task.type]} size={20} color="#16A34A" />
      </View>
      <View style={card.info}>
        <Text style={card.type}>{task.typeLabel}</Text>
        <Text style={card.desc} numberOfLines={1}>{task.description}</Text>
        <View style={card.meta}>
          <MaterialIcons name="schedule" size={12} color="#9CA3AF" />
          <Text style={card.date}>{task.date}</Text>
          <View style={[card.priorityDot, task.priority === 'Urgent' && card.urgentDot]} />
          <Text style={card.priority}>{task.priority}</Text>
        </View>
      </View>
      <StatusBadge status={task.status} />
    </View>
  </TouchableOpacity>
);
const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1 },
  type: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  desc: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  date: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  priorityDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF', marginLeft: 4 },
  urgentDot: { backgroundColor: '#EF4444' },
  priority: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
});

// ── Screen ────────────────────────────────────────────────────────────────────
const TaskListScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const active = MOCK_TASKS.filter(t => t.status !== 'completed');
  const done   = MOCK_TASKS.filter(t => t.status === 'completed');

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={s.header}>
        <Text style={s.headerTitle}>My Tasks</Text>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeText}>{MOCK_TASKS.length}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
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
            <Text style={s.sectionLabel}>Completed</Text>
            {done.map(t => (
              <TaskCard key={t.id} task={t}
                onPress={() => navigation.navigate('TaskDetail', { taskId: t.id })} />
            ))}
          </>
        )}
      </ScrollView>

      {/* Bottom Nav */}
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
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, height: 60,
    backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerBadge: {
    backgroundColor: '#16A34A', borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  headerBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  bottomNav: {
    position: 'absolute', bottom: 0, width: '100%',
    backgroundColor: '#f9f9ff', flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'flex-start', height: 90,
    borderTopWidth: 1, borderTopColor: '#e8e8f0',
    shadowColor: '#141b2b',
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12,
  },
  navItem: { alignItems: 'center', paddingTop: 16, marginBottom: 10 },
  navText: { fontSize: 11, fontWeight: '700', marginTop: 4, color: '#6B7280' },
});

export default TaskListScreen;
