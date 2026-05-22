import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getTask } from '../services/authService';

const STATUS_CONFIG = {
  PENDING:           { label: 'Pending',        color: '#6B7280', bg: '#F3F4F6' },
  ASSIGNED:          { label: 'Assigned',        color: '#2563EB', bg: '#EFF6FF' },
  ARRIVED:           { label: 'Driver Arrived',  color: '#7C3AED', bg: '#F5F3FF' },
  AWAITING_APPROVAL: { label: 'Needs Approval',  color: '#D97706', bg: '#FFFBEB' },
  PURCHASED:         { label: 'Purchased',       color: '#0891B2', bg: '#ECFEFF' },
  DELIVERING:        { label: 'Delivering',      color: '#EA580C', bg: '#FFF7ED' },
  COMPLETED:         { label: 'Completed',       color: '#16A34A', bg: '#F0FDF4' },
  CANCELLED:         { label: 'Cancelled',       color: '#DC2626', bg: '#FEF2F2' },
};

const STATUS_STEPS  = ['PENDING', 'ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING', 'COMPLETED'];
const STATUS_LABELS = ['Pending', 'Assigned', 'Arrived', 'Approval', 'Purchased', 'Delivering', 'Done'];

const TYPE_META = {
  DELIVERY: { icon: 'local-shipping', label: 'Pick & Drop' },
  SHOPPING: { icon: 'shopping-bag',   label: 'Buy Something' },
  ERRAND:   { icon: 'assignment',     label: 'Run Errand' },
};

const StatusFlow = ({ currentStatus }) => {
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);
  return (
    <View style={s.flowRow}>
      {STATUS_STEPS.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <React.Fragment key={step}>
            <View style={s.flowStep}>
              <View style={[s.flowDot, done && s.flowDotDone, active && s.flowDotActive]}>
                {done && <MaterialIcons name="check" size={10} color="#fff" />}
                {active && <View style={s.flowDotInner} />}
              </View>
              <Text style={[s.flowLabel, active && s.flowLabelActive]} numberOfLines={1}>
                {STATUS_LABELS[i]}
              </Text>
            </View>
            {i < STATUS_STEPS.length - 1 && (
              <View style={[s.flowLine, i < currentIdx && s.flowLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const TaskTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { taskId } = route.params;
  const [task, setTask]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getTask(taskId);
      if (data?.id) setTask(data);
    } catch (err) {
      console.warn('[Tracking]', err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
    // Poll every 10s for status updates
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const cfg  = task ? (STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING) : null;
  const meta = task ? (TYPE_META[task.type] || TYPE_META.ERRAND) : null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Map placeholder */}
      <View style={s.map}>
        {[...Array(8)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridLine, s.gridH, { top: `${(i + 1) * 11}%` }]} />
        ))}
        {[...Array(6)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridLine, s.gridV, { left: `${(i + 1) * 14}%` }]} />
        ))}
        <View style={s.mapCenter}>
          <View style={s.mapPinOuter}>
            <View style={s.mapPinInner} />
          </View>
          <Text style={s.mapLabel}>Live Tracking</Text>
          <Text style={s.mapSub}>Map integration coming soon</Text>
        </View>
      </View>

      {/* Back button */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
      >
        <MaterialIcons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>

      {/* Bottom sheet */}
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <ActivityIndicator color="#16A34A" />
          </View>
        ) : !task ? (
          <Text style={{ color: '#6B7280', textAlign: 'center', paddingVertical: 24 }}>Task not found.</Text>
        ) : (
          <>
            {/* Driver / task row */}
            <View style={s.driverRow}>
              <View style={s.avatar}>
                <MaterialIcons name={meta.icon} size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>
                  {task.driver ? `Driver #${task.driver}` : 'Awaiting driver'}
                </Text>
                <Text style={s.driverSub}>{meta.label} • #{task.id}</Text>
              </View>
              <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                <View style={[s.statusDot, { backgroundColor: cfg.color }]} />
                <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </View>

            <View style={s.divider} />

            <Text style={s.flowTitle}>Task Progress</Text>
            <StatusFlow currentStatus={task.status} />

            {/* Needs approval CTA */}
            {task.status === 'AWAITING_APPROVAL' && (
              <TouchableOpacity
                style={s.approveBtn}
                onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              >
                <MaterialIcons name="pending-actions" size={18} color="#fff" />
                <Text style={s.approveBtnText}>Approve Purchase</Text>
              </TouchableOpacity>
            )}

            {task.status === 'COMPLETED' && (
              <View style={s.completedRow}>
                <MaterialIcons name="check-circle" size={18} color="#16A34A" />
                <Text style={s.completedText}>Task completed successfully!</Text>
              </View>
            )}

            {!['AWAITING_APPROVAL', 'COMPLETED', 'CANCELLED'].includes(task.status) && (
              <View style={s.etaRow}>
                <ActivityIndicator size="small" color="#16A34A" style={{ marginRight: 6 }} />
                <Text style={s.etaText}>Updating every 10 seconds...</Text>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E5E7EB' },

  map: { flex: 1, backgroundColor: '#E8EEF4', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  gridLine: { position: 'absolute', backgroundColor: '#D1D9E0' },
  gridH: { left: 0, right: 0, height: 1 },
  gridV: { top: 0, bottom: 0, width: 1 },
  mapCenter: { alignItems: 'center', gap: 8 },
  mapPinOuter: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(22,163,74,0.15)', borderWidth: 2, borderColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  mapPinInner: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#16A34A' },
  mapLabel: { fontSize: 16, fontWeight: '700', color: '#374151' },
  mapSub: { fontSize: 12, color: '#9CA3AF' },

  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },

  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 20 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginBottom: 16 },

  flowTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  flowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  flowStep: { alignItems: 'center', gap: 5 },
  flowDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  flowDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  flowDotActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  flowDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  flowLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 20 },
  flowLineDone: { backgroundColor: '#16A34A' },
  flowLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center', maxWidth: 40 },
  flowLabelActive: { color: '#16A34A' },

  approveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#D97706', borderRadius: 14, paddingVertical: 14, marginTop: 4 },
  approveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12 },
  completedText: { fontSize: 14, fontWeight: '600', color: '#16A34A' },

  etaRow: { flexDirection: 'row', alignItems: 'center' },
  etaText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

export default TaskTrackingScreen;
