import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getTaskDetail, getActiveTask, transitionTask } from '../services/driverService';

const C = {
  primary:    '#006e2f', primaryC:   '#22c55e', onPrimaryC: '#004b1e',
  bg:         '#f8f9fa', surface:    '#ffffff', surfaceC:   '#edeeef',
  surfaceCL:  '#f3f4f5', surfaceCH:  '#e7e8e9',
  onSurface:  '#191c1d', onSurfaceV: '#3d4a3d',
  outline:    '#6d7b6c', outlineV:   '#bccbb9',
  tertiary:   '#005ac2', tertiaryC:  '#82abff',
  secondaryC: '#dae2fd', error:      '#ba1a1a',
  warning:    '#f59e0b', warningC:   '#fef3c7',
};

// Maps each current status → the next action the driver can take
const NEXT_ACTION = {
  ASSIGNED:          { action: 'mark_arrived',     label: "I've Arrived",      icon: 'place',            color: C.tertiary,  bg: C.secondaryC },
  ARRIVED:           { action: 'request_approval', label: 'Request Approval',  icon: 'pending-actions',  color: C.warning,   bg: C.warningC   },
  AWAITING_APPROVAL: null, // waiting for customer — no driver action
  PURCHASED:         { action: 'start_delivery',   label: 'Start Delivery',    icon: 'local-shipping',   color: C.primary,   bg: '#dcfce7'    },
  DELIVERING:        { action: 'complete_task',    label: 'Complete Delivery', icon: 'check-circle',     color: C.primaryC,  bg: '#dcfce7'    },
  COMPLETED:         null,
};

const STATUS_STEPS  = ['ASSIGNED', 'ARRIVED', 'AWAITING_APPROVAL', 'PURCHASED', 'DELIVERING', 'COMPLETED'];
const STATUS_LABELS = ['Assigned', 'Arrived', 'Approval', 'Purchased', 'Delivering', 'Done'];

const TYPE_META = {
  DELIVERY: { icon: 'local-shipping', color: C.tertiaryC,  text: '#003d88' },
  SHOPPING: { icon: 'shopping-bag',   color: C.secondaryC, text: '#5c647a' },
  ERRAND:   { icon: 'assignment',     color: C.surfaceCH,  text: C.onSurfaceV },
};

export default function DriverActiveTaskScreen({ navigation, route }) {
  const taskId = route?.params?.taskId ?? null;
  const [task, setTask]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);

  const loadTask = useCallback(async () => {
    setLoading(true);
    try {
      const data = taskId ? await getTaskDetail(taskId) : await getActiveTask();
      setTask(data?.id ? data : null);
    } catch {
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', loadTask);
    return unsub;
  }, [navigation, loadTask]);

  const handleAction = async (action) => {
    if (!task) return;
    setActioning(true);
    try {
      console.log('[Transition] calling action:', action, 'task:', task.id);
      const updated = await transitionTask(task.id, action);
      console.log('[Transition] response:', JSON.stringify(updated));
      if (updated?.id) {
        setTask(updated);
        if (action === 'complete_task') {
          Alert.alert('Task Complete', 'Great work! The delivery has been completed.', [
            { text: 'OK', onPress: () => navigation.navigate('DriverHome') },
          ]);
        }
      } else {
        Alert.alert('Error', updated?.error || 'Could not update task status.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActioning(false);
    }
  };

  const stepIndex   = task ? STATUS_STEPS.indexOf(task.status) : -1;
  const nextAction  = task ? NEXT_ACTION[task.status] : null;
  const meta        = task ? (TYPE_META[task.type] || TYPE_META.ERRAND) : null;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.avatar}>
            <MaterialIcons name="local-shipping" size={18} color={C.primary} />
          </View>
          <Text style={s.headerTitle}>Active Task</Text>
        </View>
        <TouchableOpacity style={s.refreshBtn} onPress={loadTask}>
          <MaterialIcons name="refresh" size={22} color={C.primary} />
        </TouchableOpacity>
      </View>

      {/* Map placeholder */}
      <View style={s.mapBox}>
        {[...Array(7)].map((_, i) => (
          <View key={`h${i}`} style={[s.gridLine, s.gridH, { top: `${(i + 1) * 12}%` }]} />
        ))}
        {[...Array(5)].map((_, i) => (
          <View key={`v${i}`} style={[s.gridLine, s.gridV, { left: `${(i + 1) * 16}%` }]} />
        ))}
        <View style={s.gpsBadge}>
          <View style={s.gpsDot} />
          <Text style={s.gpsText}>GPS Active</Text>
        </View>
        <View style={s.mapPin}>
          <MaterialIcons name="local-shipping" size={30} color={C.primary} />
        </View>
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={C.primaryC} />
        </View>
      ) : !task ? (
        <View style={s.centerBox}>
          <MaterialIcons name="inbox" size={52} color={C.outlineV} />
          <Text style={s.emptyTitle}>No active task</Text>
          <Text style={s.emptySub}>Accept a task from the home screen to get started.</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: 110 }]}
        >
          {/* Status + earnings */}
          <View style={s.statusCard}>
            <View>
              <Text style={s.earningsLabel}>Estimated Earnings</Text>
              <Text style={s.earningsAmount}>
                {task.estimated_price ? `${task.estimated_price} ETB` : 'TBD'}
              </Text>
            </View>
            <View style={s.statusRight}>
              <View style={[s.statusBadge, { backgroundColor: meta.color + '60' }]}>
                <MaterialIcons name={meta.icon} size={13} color={meta.text} />
                <Text style={[s.statusBadgeText, { color: meta.text }]}>{task.type}</Text>
              </View>
              <Text style={s.orderNum}>Order #{task.id}</Text>
            </View>
          </View>

          {/* Progress stepper */}
          <View style={s.stepperCard}>
            <View style={s.stepperRow}>
              {STATUS_STEPS.map((step, i) => {
                const done    = i <= stepIndex;
                const current = i === stepIndex;
                return (
                  <React.Fragment key={step}>
                    <View style={s.stepItem}>
                      <View style={[
                        s.stepDot,
                        done    && s.stepDotDone,
                        current && s.stepDotCurrent,
                      ]}>
                        {done
                          ? <MaterialIcons name="check" size={10} color="#fff" />
                          : <View style={[s.stepDotInner, current && { backgroundColor: C.primaryC }]} />
                        }
                      </View>
                      <Text style={[s.stepLabel, done && s.stepLabelDone]}
                        numberOfLines={1}>
                        {STATUS_LABELS[i]}
                      </Text>
                    </View>
                    {i < STATUS_STEPS.length - 1 && (
                      <View style={[s.stepLine, i < stepIndex && s.stepLineDone]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>

          {/* Locations */}
          <View style={s.locationCard}>
            <View style={s.locationRow}>
              <View style={[s.locationIcon, { backgroundColor: '#dcfce7' }]}>
                <MaterialIcons name="trip-origin" size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.locationLabel}>Pickup</Text>
                <Text style={s.locationCoord}>{task.pickup_lat}, {task.pickup_lng}</Text>
              </View>
            </View>
            <View style={s.locationDivider} />
            <View style={s.locationRow}>
              <View style={[s.locationIcon, { backgroundColor: C.secondaryC }]}>
                <MaterialIcons name="place" size={18} color={C.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.locationLabel}>Dropoff</Text>
                <Text style={s.locationCoord}>{task.dropoff_lat}, {task.dropoff_lng}</Text>
              </View>
            </View>
            {task.estimated_distance_km ? (
              <View style={s.distRow}>
                <MaterialIcons name="straighten" size={14} color={C.onSurfaceV} />
                <Text style={s.distText}>{task.estimated_distance_km} km estimated</Text>
              </View>
            ) : null}
          </View>

          {/* Note */}
          {task.note ? (
            <View style={s.noteCard}>
              <View style={s.noteHeader}>
                <MaterialIcons name="info-outline" size={16} color={C.tertiary} />
                <Text style={s.noteTitle}>Note from Customer</Text>
              </View>
              <Text style={s.noteText}>{task.note}</Text>
            </View>
          ) : null}

          {/* Waiting for customer banner */}
          {task.status === 'AWAITING_APPROVAL' && (
            <View style={s.waitingBanner}>
              <ActivityIndicator size="small" color={C.warning} />
              <Text style={s.waitingText}>Waiting for customer approval...</Text>
            </View>
          )}

          {/* Completed banner */}
          {task.status === 'COMPLETED' && (
            <View style={s.completedBanner}>
              <MaterialIcons name="check-circle" size={24} color={C.primaryC} />
              <Text style={s.completedText}>Task completed successfully!</Text>
            </View>
          )}

          {/* Action button */}
          {nextAction && (
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: nextAction.bg }, actioning && s.btnDisabled]}
              onPress={() => handleAction(nextAction.action)}
              disabled={actioning}
              activeOpacity={0.85}
            >
              {actioning ? (
                <ActivityIndicator color={nextAction.color} />
              ) : (
                <>
                  <MaterialIcons name={nextAction.icon} size={22} color={nextAction.color} />
                  <Text style={[s.actionBtnText, { color: nextAction.color }]}>
                    {nextAction.label}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('DriverHome')}>
          <MaterialIcons name="home" size={22} color={C.onSurfaceV} />
          <Text style={s.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItemActive}>
          <MaterialIcons name="directions-run" size={22} color={C.onPrimaryC} />
          <Text style={s.navTextActive}>Active Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('DriverProfile')}>
          <MaterialIcons name="person-outline" size={22} color={C.onSurfaceV} />
          <Text style={s.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56, backgroundColor: C.bg },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceCH, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.primary },
  refreshBtn:  { padding: 6 },

  mapBox:   { height: 180, backgroundColor: '#e8eef4', overflow: 'hidden', position: 'relative' },
  gridLine: { position: 'absolute', backgroundColor: '#d1d9e0' },
  gridH:    { left: 0, right: 0, height: 1 },
  gridV:    { top: 0, bottom: 0, width: 1 },
  gpsBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.outlineV },
  gpsDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryC },
  gpsText:  { fontSize: 12, color: C.onSurface, fontWeight: '500' },
  mapPin:   { position: 'absolute', top: '38%', left: '44%' },

  centerBox:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: C.onSurfaceV },
  emptySub:   { fontSize: 13, color: C.outline, textAlign: 'center' },

  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: 12 },

  // Status card
  statusCard:      { backgroundColor: C.surface, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
  earningsLabel:   { fontSize: 11, color: C.onSurfaceV, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  earningsAmount:  { fontSize: 28, fontWeight: '900', color: C.primary, letterSpacing: -0.5 },
  statusRight:     { alignItems: 'flex-end', gap: 6 },
  statusBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderNum:        { fontSize: 12, color: C.outline },

  // Stepper
  stepperCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, elevation: 1 },
  stepperRow:  { flexDirection: 'row', alignItems: 'flex-start' },
  stepItem:    { alignItems: 'center', gap: 4, flex: 0 },
  stepDot:     { width: 22, height: 22, borderRadius: 11, backgroundColor: C.surfaceCH, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.outlineV },
  stepDotDone: { backgroundColor: C.primary, borderColor: C.primary },
  stepDotCurrent: { borderColor: C.primaryC, backgroundColor: '#fff' },
  stepDotInner:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.outlineV },
  stepLine:    { flex: 1, height: 2, backgroundColor: C.outlineV, marginTop: 10, marginHorizontal: 2 },
  stepLineDone:{ backgroundColor: C.primary },
  stepLabel:   { fontSize: 9, color: C.outline, textAlign: 'center', maxWidth: 44 },
  stepLabelDone: { color: C.primary, fontWeight: '600' },

  // Locations
  locationCard:    { backgroundColor: C.surface, borderRadius: 16, padding: 16, elevation: 1 },
  locationRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  locationIcon:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  locationLabel:   { fontSize: 11, color: C.onSurfaceV, marginBottom: 2 },
  locationCoord:   { fontSize: 13, fontWeight: '600', color: C.onSurface },
  locationDivider: { height: 1, backgroundColor: C.outlineV + '30', marginLeft: 52 },
  distRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingLeft: 4 },
  distText:        { fontSize: 13, color: C.onSurfaceV },

  // Note
  noteCard:   { backgroundColor: C.tertiaryC + '20', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.tertiaryC + '50', gap: 6 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteTitle:  { fontSize: 13, fontWeight: '700', color: C.tertiary },
  noteText:   { fontSize: 13, color: '#003d88', lineHeight: 20 },

  // Waiting / completed banners
  waitingBanner:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.warningC, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.warning + '50' },
  waitingText:    { fontSize: 14, fontWeight: '600', color: C.warning },
  completedBanner:{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#dcfce7', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.primaryC + '50' },
  completedText:  { fontSize: 14, fontWeight: '600', color: C.primary },

  // Action button
  actionBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 58, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', elevation: 2 },
  actionBtnText: { fontSize: 16, fontWeight: '700' },
  btnDisabled:   { opacity: 0.6 },

  // Bottom nav
  bottomNav:     { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: C.surface, paddingTop: 10, paddingBottom: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
  navItemActive: { flexDirection: 'column', alignItems: 'center', backgroundColor: C.primaryC, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 30, gap: 2 },
  navItem:       { flexDirection: 'column', alignItems: 'center', padding: 8, gap: 2 },
  navTextActive: { fontSize: 11, fontWeight: '600', color: C.onPrimaryC },
  navText:       { fontSize: 11, fontWeight: '500', color: C.onSurfaceV },
});
