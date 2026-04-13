import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MOCK_TASKS, STATUS_CONFIG, STATUS_FLOW, STATUS_FLOW_LABELS } from '../data/mockTasks';

// ── Status flow (horizontal) ──────────────────────────────────────────────────
const StatusFlow = ({ currentStatus }) => {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  return (
    <View style={s.flowRow}>
      {STATUS_FLOW_LABELS.map((label, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={label}>
            <View style={s.flowStep}>
              <View style={[s.flowDot, done && s.flowDotDone, active && s.flowDotActive]}>
                {done && <MaterialIcons name="check" size={10} color="#fff" />}
                {active && <View style={s.flowDotInner} />}
              </View>
              <Text style={[s.flowLabel, active && s.flowLabelActive]}>{label}</Text>
            </View>
            {i < STATUS_FLOW.length - 1 && (
              <View style={[s.flowLine, i < currentIdx && s.flowLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
const TaskTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { taskId } = route.params;
  const task = MOCK_TASKS.find(t => t.id === taskId);
  if (!task) return null;

  const cfg = STATUS_CONFIG[task.status];

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Map placeholder — full screen */}
      <View style={s.map}>
        {/* Fake map grid lines */}
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridLine, s.gridH, { top: `${(i + 1) * 11}%` }]} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridLine, s.gridV, { left: `${(i + 1) * 14}%` }]} />
        ))}
        {/* Center pin */}
        <View style={s.mapCenter}>
          <View style={s.mapPinOuter}>
            <View style={s.mapPinInner} />
          </View>
          <Text style={s.mapLabel}>Map View</Text>
          <Text style={s.mapSub}>Live tracking coming soon</Text>
        </View>
      </View>

      {/* Back button overlay */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <MaterialIcons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>

        {/* Driver row */}
        <View style={s.driverRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{task.driver?.name?.charAt(0) ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.driverName}>{task.driver?.name ?? 'Awaiting worker'}</Text>
            <Text style={s.driverSub}>{task.typeLabel}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
            <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Status flow */}
        <Text style={s.flowTitle}>Task Progress</Text>
        <StatusFlow currentStatus={task.status} />

        {/* ETA row */}
        <View style={s.etaRow}>
          <MaterialIcons name="access-time" size={14} color="#6B7280" />
          <Text style={s.etaText}>
            {task.status === 'in_progress' ? 'Estimated arrival: ~15 min' : 'Worker on the way'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },

  // Map
  map: {
    flex: 1, backgroundColor: '#E8EEF4',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  gridLine: { position: 'absolute', backgroundColor: '#D1D9E0' },
  gridH: { left: 0, right: 0, height: 1 },
  gridV: { top: 0, bottom: 0, width: 1 },
  mapCenter: { alignItems: 'center', gap: 8 },
  mapPinOuter: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(22,163,74,0.15)', borderWidth: 2, borderColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  mapPinInner: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A' },
  mapLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  mapSub: { fontSize: 12, color: '#9CA3AF' },

  // Back button
  backBtn: {
    position: 'absolute', left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },

  // Bottom sheet
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.08, shadowRadius: 20, elevation: 20,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },

  // Flow
  flowTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  flowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  flowStep: { alignItems: 'center', gap: 5 },
  flowDot: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#E5E7EB', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  flowDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  flowDotActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  flowDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  flowLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 20 },
  flowLineDone: { backgroundColor: '#16A34A' },
  flowLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600',
    textTransform: 'uppercase', textAlign: 'center', maxWidth: 52 },
  flowLabelActive: { color: '#16A34A' },

  // ETA
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  etaText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

export default TaskTrackingScreen;
