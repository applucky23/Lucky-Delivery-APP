import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getTask, cancelTask, approveTask } from '../services/authService';

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

const SectionCard = ({ title, children }) => (
  <View style={s.card}>
    {title ? <Text style={s.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

const InfoRow = ({ label, value, last }) => (
  <View style={[s.infoRow, last && { borderBottomWidth: 0 }]}>
    <Text style={s.infoLabel}>{label}</Text>
    <Text style={s.infoValue}>{value || '—'}</Text>
  </View>
);

const TaskDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { taskId } = route.params;
  const [task, setTask]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null); // 'cancel' | 'approve'

  const load = useCallback(async () => {
    try {
      const data = await getTask(taskId);
      if (data?.id) setTask(data);
    } catch (err) {
      console.warn('[TaskDetail]', err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', load);
    return unsub;
  }, [navigation, load]);

  const handleCancel = () => {
    Alert.alert('Cancel Task', 'Are you sure you want to cancel this task?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        setActioning('cancel');
        try {
          const res = await cancelTask(taskId);
          if (res?.message) {
            Alert.alert('Cancelled', 'Your task has been cancelled.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          } else {
            Alert.alert('Error', res?.error || 'Could not cancel task.');
          }
        } catch (err) {
          Alert.alert('Error', err.message);
        } finally {
          setActioning(null);
        }
      }},
    ]);
  };

  const handleApprove = async () => {
    setActioning('approve');
    try {
      const res = await approveTask(taskId);
      if (res?.id) {
        setTask(res);
        Alert.alert('Approved!', 'The driver will now start the delivery.');
      } else {
        Alert.alert('Error', res?.error || 'Could not approve.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActioning(null);
    }
  };

  if (loading) return (
    <View style={[s.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color="#16A34A" />
    </View>
  );

  if (!task) return (
    <View style={[s.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: '#6B7280' }}>Task not found.</Text>
    </View>
  );

  const cfg      = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
  const meta     = TYPE_META[task.type] || TYPE_META.ERRAND;
  const stepIdx  = STATUS_STEPS.indexOf(task.status);
  const isActive = !['COMPLETED', 'CANCELLED'].includes(task.status);
  const canCancel  = ['PENDING', 'ASSIGNED'].includes(task.status);
  const canApprove = task.status === 'AWAITING_APPROVAL';

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Task Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero status */}
        <View style={[s.heroCard, { backgroundColor: cfg.bg }]}>
          <View style={s.heroLeft}>
            <View style={[s.heroIcon, { backgroundColor: '#fff' }]}>
              <MaterialIcons name={meta.icon} size={24} color="#16A34A" />
            </View>
            <View>
              <Text style={s.heroType}>{meta.label}</Text>
              <Text style={[s.heroStatus, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          <Text style={s.heroId}>#{task.id}</Text>
        </View>

        {/* Progress stepper */}
        <SectionCard title="Progress">
          <View style={s.stepperRow}>
            {STATUS_STEPS.map((step, i) => {
              const done    = i <= stepIdx;
              const current = i === stepIdx;
              return (
                <React.Fragment key={step}>
                  <View style={s.stepItem}>
                    <View style={[s.stepDot, done && s.stepDotDone, current && s.stepDotCurrent]}>
                      {done ? <MaterialIcons name="check" size={10} color="#fff" /> : null}
                    </View>
                    <Text style={[s.stepLabel, done && s.stepLabelDone]} numberOfLines={1}>
                      {STATUS_LABELS[i]}
                    </Text>
                  </View>
                  {i < STATUS_STEPS.length - 1 && (
                    <View style={[s.stepLine, i < stepIdx && s.stepLineDone]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </SectionCard>

        {/* Task info */}
        <SectionCard title="Task Info">
          <InfoRow label="Type"     value={meta.label} />
          <InfoRow label="Note"     value={task.note} />
          <InfoRow label="Distance" value={task.estimated_distance_km ? `${task.estimated_distance_km} km` : null} />
          <InfoRow label="Created"  value={task.created_at ? new Date(task.created_at).toLocaleString() : null} last />
        </SectionCard>

        {/* Locations */}
        <SectionCard title="Locations">
          <View style={s.locationRow}>
            <View style={[s.locationIcon, { backgroundColor: '#F0FDF4' }]}>
              <MaterialIcons name="trip-origin" size={16} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.locationLabel}>Pickup</Text>
              <Text style={s.locationAddress}>{task.pickup_lat}, {task.pickup_lng}</Text>
            </View>
          </View>
          <View style={s.locationDivider} />
          <View style={s.locationRow}>
            <View style={[s.locationIcon, { backgroundColor: '#EFF6FF' }]}>
              <MaterialIcons name="place" size={16} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.locationLabel}>Dropoff</Text>
              <Text style={s.locationAddress}>{task.dropoff_lat}, {task.dropoff_lng}</Text>
            </View>
          </View>
        </SectionCard>

        {/* Driver */}
        {task.driver && (
          <SectionCard title="Driver">
            <View style={s.driverRow}>
              <View style={s.driverAvatar}>
                <MaterialIcons name="person" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.driverName}>{task.driver}</Text>
                <View style={[s.driverBadge, { backgroundColor: cfg.bg }]}>
                  <Text style={[s.driverBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
              </View>
            </View>
          </SectionCard>
        )}

        {/* Pricing */}
        <SectionCard title="Pricing">
          <InfoRow label="Estimated Price" value={task.estimated_price ? `${task.estimated_price} ETB` : null} />
          <InfoRow label="Final Price"     value={task.final_price ? `${task.final_price} ETB` : null} last />
        </SectionCard>

        {/* Approve banner */}
        {canApprove && (
          <View style={s.approveBanner}>
            <MaterialIcons name="pending-actions" size={20} color="#D97706" />
            <Text style={s.approveBannerText}>
              The driver has completed the purchase. Please review and approve to continue.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action bar */}
      {(canApprove || canCancel || isActive) && (
        <View style={[s.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
          {canCancel && (
            <TouchableOpacity
              style={[s.btnSecondary, actioning === 'cancel' && { opacity: 0.6 }]}
              onPress={handleCancel}
              disabled={!!actioning}
            >
              {actioning === 'cancel'
                ? <ActivityIndicator color="#DC2626" size="small" />
                : <Text style={s.btnSecondaryText}>Cancel Task</Text>
              }
            </TouchableOpacity>
          )}

          {canApprove && (
            <TouchableOpacity
              style={[s.btnApprove, actioning === 'approve' && { opacity: 0.6 }]}
              onPress={handleApprove}
              disabled={!!actioning}
            >
              {actioning === 'approve'
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <MaterialIcons name="check-circle" size={18} color="#fff" />
                    <Text style={s.btnApproveText}>Approve Purchase</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          {isActive && !canApprove && (
            <TouchableOpacity
              style={s.btnTrack}
              onPress={() => navigation.navigate('TaskTracking', { taskId: task.id })}
            >
              <MaterialIcons name="my-location" size={18} color="#fff" />
              <Text style={s.btnTrackText}>Track Task</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  heroCard: { borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  heroType: { fontSize: 16, fontWeight: '700', color: '#111827' },
  heroStatus: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroId: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },

  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12 },
  infoLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '600', textAlign: 'right', flex: 1 },

  stepperRow: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  stepDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  stepDotCurrent: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 18 },
  stepLineDone: { backgroundColor: '#16A34A' },
  stepLabel: { fontSize: 8, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', textAlign: 'center', maxWidth: 40 },
  stepLabelDone: { color: '#16A34A' },

  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  locationIcon: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  locationLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationAddress: { fontSize: 13, color: '#111827', fontWeight: '600' },
  locationDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4, marginLeft: 38 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 4 },
  driverBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  driverBadgeText: { fontSize: 11, fontWeight: '700' },

  approveBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  approveBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 20 },

  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 10 },
  btnSecondary: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  btnSecondaryText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
  btnApprove: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14 },
  btnApproveText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnTrack: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14 },
  btnTrackText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default TaskDetailScreen;
