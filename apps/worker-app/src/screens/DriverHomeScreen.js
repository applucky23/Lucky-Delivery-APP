import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { getDriverAssignments, acceptTask, rejectTask, getDriverProfile, updateDriverProfile } from '../services/driverService';

const C = {
  primary:    '#006e2f',
  primaryC:   '#22c55e',
  onPrimaryC: '#004b1e',
  bg:         '#f8f9fa',
  surface:    '#ffffff',
  surfaceC:   '#edeeef',
  surfaceCL:  '#f3f4f5',
  surfaceCH:  '#e7e8e9',
  onSurface:  '#191c1d',
  onSurfaceV: '#3d4a3d',
  outline:    '#6d7b6c',
  outlineV:   '#bccbb9',
  tertiary:   '#005ac2',
  tertiaryC:  '#82abff',
  secondaryC: '#dae2fd',
  error:      '#ba1a1a',
  errorC:     '#ffdad6',
};

const TYPE_META = {
  DELIVERY: { label: 'Delivery', icon: 'local-shipping',  color: C.tertiaryC,  textColor: '#003d88' },
  SHOPPING: { label: 'Shopping', icon: 'shopping-bag',    color: C.secondaryC, textColor: '#5c647a' },
  ERRAND:   { label: 'Errand',   icon: 'assignment',      color: C.surfaceCH,  textColor: C.onSurfaceV },
};

export default function DriverHomeScreen({ navigation }) {
  const [online, setOnline]           = useState(false);  // synced from backend
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [driverName, setDriverName]   = useState('');

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await getDriverAssignments();
      if (Array.isArray(data)) {
        setAssignments(data);
        setError(null);
      } else if (data?.error) {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
      console.warn('[Home] fetch assignments:', err.message);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const profile = await getDriverProfile();
        if (profile?.full_name) setDriverName(profile.full_name.split(' ')[0]);
        if (typeof profile?.is_online === 'boolean') setOnline(profile.is_online);
      } catch {}
      await fetchAssignments();
      setLoading(false);
    };
    init();

    // Poll every 15s for new assignments
    const interval = setInterval(fetchAssignments, 15000);
    return () => clearInterval(interval);
  }, [fetchAssignments]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignments();
    setRefreshing(false);
  };

  const handleAccept = async (assignment) => {
    const taskId = assignment.task.id;
    setActionLoading(prev => ({ ...prev, [assignment.id]: 'accept' }));
    try {
      const res = await acceptTask(taskId);
      if (res?.message) {
        // Remove from list and go to active task
        setAssignments(prev => prev.filter(a => a.id !== assignment.id));
        navigation.navigate('DriverActiveTask', { taskId });
      } else {
        Alert.alert('Error', res?.error || 'Could not accept task.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [assignment.id]: null }));
    }
  };

  const handleReject = async (assignment) => {
    const taskId = assignment.task.id;
    setActionLoading(prev => ({ ...prev, [assignment.id]: 'reject' }));
    try {
      const res = await rejectTask(taskId);
      if (res?.message) {
        setAssignments(prev => prev.filter(a => a.id !== assignment.id));
      } else {
        Alert.alert('Error', res?.error || 'Could not reject task.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [assignment.id]: null }));
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.avatar}>
            <MaterialIcons name="person" size={20} color={C.primary} />
          </View>
          <Text style={s.headerTitle}>
            {driverName ? `Hi, ${driverName}` : 'Driver Console'}
          </Text>
        </View>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={[s.onlineToggle, online ? s.onlineOn : s.onlineOff]}
            onPress={async () => {
              const next = !online;
              setOnline(next);
              try {
                await updateDriverProfile({ is_online: next });
              } catch (err) {
                // revert on failure
                setOnline(!next);
                console.warn('[Toggle] failed:', err.message);
              }
            }}
          >
            <View style={[s.onlineDot, { backgroundColor: online ? '#fff' : C.outlineV }]} />
            <Text style={[s.onlineText, { color: online ? '#fff' : C.onSurfaceV }]}>
              {online ? 'Online' : 'Offline'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <MaterialIcons name="notifications-none" size={24} color={C.onSurfaceV} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: 110 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primaryC]} />}
      >
        {/* Earnings Card */}
        <View style={s.earningsCard}>
          <View style={s.earningsTop}>
            <View>
              <Text style={s.earningsLabel}>Current Balance</Text>
              <Text style={s.earningsAmount}>0.00 ETB</Text>
            </View>
            <View style={s.walletIcon}>
              <MaterialIcons name="account-balance-wallet" size={24} color={C.onPrimaryC} />
            </View>
          </View>
          <View style={s.earningsDivider} />
          <View style={s.earningsRow}>
            {[['Daily', '0 ETB'], ['Weekly', '0 ETB'], ['Monthly', '0 ETB']].map(([label, val], i) => (
              <View key={label} style={[s.earningsStat, i === 1 && s.earningsStatBorder]}>
                <Text style={s.earningsStatLabel}>{label}</Text>
                <Text style={s.earningsStatVal}>{val}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Task Assignments */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Available Tasks</Text>
          {assignments.length > 0 && (
            <View style={s.nearbyBadge}>
              <Text style={s.nearbyText}>{assignments.length} Pending</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={s.emptyBox}>
            <ActivityIndicator size="large" color={C.primaryC} />
          </View>
        ) : error ? (
          <View style={s.emptyBox}>
            <MaterialIcons name="wifi-off" size={48} color={C.outlineV} />
            <Text style={s.emptyTitle}>Could not load tasks</Text>
            <Text style={s.emptySub}>{error}</Text>
          </View>
        ) : assignments.length === 0 ? (
          <View style={s.emptyBox}>
            <MaterialIcons name="inbox" size={48} color={C.outlineV} />
            <Text style={s.emptyTitle}>No tasks right now</Text>
            <Text style={s.emptySub}>Pull down to refresh or wait — new tasks will appear here.</Text>
          </View>
        ) : (
          assignments.map(assignment => {
            const task = assignment.task;
            const meta = TYPE_META[task.type] || TYPE_META.ERRAND;
            const isActing = actionLoading[assignment.id];

            return (
              <View key={assignment.id} style={s.taskCard}>
                <View style={s.taskTop}>
                  <View style={s.taskLeft}>
                    <View style={[s.taskIconBox, { backgroundColor: meta.color + '40' }]}>
                      <MaterialIcons name={meta.icon} size={22} color={meta.textColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={[s.taskBadge, { backgroundColor: meta.color }]}>
                        <Text style={[s.taskBadgeText, { color: meta.textColor }]}>{meta.label}</Text>
                      </View>

                      {/* Pickup */}
                      <View style={s.locationRow}>
                        <MaterialIcons name="trip-origin" size={13} color={C.primary} />
                        <Text style={s.locationText} numberOfLines={1}>
                          {task.pickup_lat}, {task.pickup_lng}
                        </Text>
                      </View>

                      {/* Dropoff */}
                      <View style={s.locationRow}>
                        <MaterialIcons name="place" size={13} color={C.error} />
                        <Text style={s.locationText} numberOfLines={1}>
                          {task.dropoff_lat}, {task.dropoff_lng}
                        </Text>
                      </View>

                      {task.estimated_distance_km && (
                        <View style={s.taskDistRow}>
                          <MaterialIcons name="straighten" size={13} color={C.onSurfaceV} />
                          <Text style={s.taskDist}>{task.estimated_distance_km} km</Text>
                        </View>
                      )}

                      {task.note ? (
                        <Text style={s.taskNote} numberOfLines={2}>📝 {task.note}</Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={s.taskRight}>
                    {task.estimated_price ? (
                      <Text style={s.taskPrice}>{task.estimated_price} ETB</Text>
                    ) : (
                      <Text style={s.taskPricePending}>TBD</Text>
                    )}
                    <Text style={s.taskId}>#{task.id}</Text>
                  </View>
                </View>

                <View style={s.taskBtns}>
                  <TouchableOpacity
                    style={[s.acceptBtn, isActing && s.btnLoading]}
                    onPress={() => handleAccept(assignment)}
                    disabled={!!isActing}
                  >
                    {isActing === 'accept'
                      ? <ActivityIndicator color={C.onPrimaryC} size="small" />
                      : <Text style={s.acceptText}>Accept</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.declineBtn, isActing && s.btnLoading]}
                    onPress={() => handleReject(assignment)}
                    disabled={!!isActing}
                  >
                    {isActing === 'reject'
                      ? <ActivityIndicator color={C.onSurfaceV} size="small" />
                      : <Text style={s.declineText}>Decline</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Emergency FAB */}
      <TouchableOpacity style={s.fab}>
        <MaterialIcons name="emergency" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Bottom Nav */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItemActive}>
          <MaterialIcons name="home" size={22} color={C.onPrimaryC} />
          <Text style={s.navTextActive}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => navigation.navigate('DriverActiveTask')}>
          <MaterialIcons name="directions-run" size={22} color={C.onSurfaceV} />
          <Text style={s.navText}>Active Task</Text>
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
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, height: 56, backgroundColor: C.bg },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surfaceCH, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.outlineV },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.primary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onlineToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  onlineOn: { backgroundColor: C.primary },
  onlineOff: { backgroundColor: C.surfaceCH },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: '600' },
  iconBtn: { padding: 6 },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  earningsCard: { backgroundColor: C.primaryC, borderRadius: 16, padding: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 6 },
  earningsTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  earningsLabel: { fontSize: 11, fontWeight: '700', color: C.onPrimaryC, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  earningsAmount: { fontSize: 32, fontWeight: '900', color: C.onPrimaryC, letterSpacing: -0.5 },
  walletIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(0,75,30,0.2)', alignItems: 'center', justifyContent: 'center' },
  earningsDivider: { height: 1, backgroundColor: 'rgba(0,75,30,0.15)', marginBottom: 16 },
  earningsRow: { flexDirection: 'row' },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsStatBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,75,30,0.15)' },
  earningsStatLabel: { fontSize: 11, color: C.onPrimaryC, opacity: 0.7, marginBottom: 4 },
  earningsStatVal: { fontSize: 16, fontWeight: '700', color: C.onPrimaryC },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.onSurface },
  nearbyBadge: { backgroundColor: C.surfaceCH, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  nearbyText: { fontSize: 12, fontWeight: '600', color: C.onSurfaceV },

  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: C.onSurfaceV },
  emptySub: { fontSize: 13, color: C.outline, textAlign: 'center', paddingHorizontal: 32 },

  taskCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.outlineV + '40', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, gap: 12 },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  taskLeft: { flexDirection: 'row', gap: 12, flex: 1 },
  taskIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  taskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 6 },
  taskBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  locationText: { fontSize: 12, color: C.onSurfaceV, flex: 1 },
  taskDistRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  taskDist: { fontSize: 13, color: C.onSurfaceV },
  taskNote: { fontSize: 12, color: C.outline, marginTop: 4, fontStyle: 'italic' },
  taskRight: { alignItems: 'flex-end', minWidth: 70 },
  taskPrice: { fontSize: 18, fontWeight: '700', color: C.primary },
  taskPricePending: { fontSize: 14, fontWeight: '600', color: C.outline },
  taskId: { fontSize: 11, color: C.outline, marginTop: 2 },
  taskBtns: { flexDirection: 'row', gap: 12 },
  acceptBtn: { flex: 1, height: 48, backgroundColor: C.primaryC, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  acceptText: { fontSize: 15, fontWeight: '600', color: C.onPrimaryC },
  declineBtn: { flex: 1, height: 48, backgroundColor: C.surfaceC, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  declineText: { fontSize: 15, fontWeight: '600', color: C.onSurfaceV },
  btnLoading: { opacity: 0.6 },

  fab: { position: 'absolute', right: 20, bottom: 110, width: 56, height: 56, borderRadius: 28, backgroundColor: C.error, alignItems: 'center', justifyContent: 'center', shadowColor: C.error, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', backgroundColor: C.surface, paddingTop: 10, paddingBottom: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
  navItemActive: { flexDirection: 'column', alignItems: 'center', backgroundColor: C.primaryC, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 30, gap: 2 },
  navItem: { flexDirection: 'column', alignItems: 'center', padding: 8, gap: 2 },
  navTextActive: { fontSize: 11, fontWeight: '600', color: C.onPrimaryC },
  navText: { fontSize: 11, fontWeight: '500', color: C.onSurfaceV },
});
