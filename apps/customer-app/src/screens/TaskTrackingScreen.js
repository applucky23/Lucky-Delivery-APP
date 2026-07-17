import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { UrlTile, Marker, Polyline } from 'react-native-maps';
import { getTask, getTaskRating } from '../services/authService';
import { useRating } from '../contexts/RatingContext';

const STATUS_CONFIG = {
  PENDING:           { label: 'Pending',           color: '#6B7280', bg: '#F3F4F6' },
  ASSIGNED:          { label: 'Assigned',           color: '#2563EB', bg: '#EFF6FF' },
  ARRIVED:           { label: 'Driver Arrived',     color: '#7C3AED', bg: '#F5F3FF' },
  AWAITING_APPROVAL: { label: 'Needs Approval',     color: '#D97706', bg: '#FFFBEB' },
  PURCHASED:         { label: 'Purchased',          color: '#0891B2', bg: '#ECFEFF' },
  DELIVERING:        { label: 'Delivering',         color: '#EA580C', bg: '#FFF7ED' },
  AWAITING_PAYMENT:  { label: 'Payment Pending',    color: '#D97706', bg: '#FFFBEB' },
  COMPLETED:         { label: 'Completed',          color: '#16A34A', bg: '#F0FDF4' },
  CANCELLED:         { label: 'Cancelled',          color: '#DC2626', bg: '#FEF2F2' },
};

const getStatusSteps = (type) => {
  if (type === 'SHOPPING') return { steps: ['PENDING', 'ASSIGNED', 'ARRIVED', 'PURCHASED', 'DELIVERING', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Pending', 'Assigned', 'Arrived', 'Purchased', 'Delivering', 'Payment', 'Done'] };
  if (type === 'ERRAND') return { steps: ['PENDING', 'ASSIGNED', 'ARRIVED', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Pending', 'Assigned', 'Arrived', 'Payment', 'Done'] };
  return { steps: ['PENDING', 'ASSIGNED', 'ARRIVED', 'DELIVERING', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Pending', 'Assigned', 'Arrived', 'Delivering', 'Payment', 'Done'] };
};

const calcDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;
};

const TYPE_META = {
  DELIVERY: { icon: 'local-shipping', label: 'Pick & Drop' },
  SHOPPING: { icon: 'shopping-bag',   label: 'Buy Something' },
  ERRAND:   { icon: 'assignment',     label: 'Run Errand' },
};

const StatusFlow = ({ currentStatus, taskType }) => {
  const { steps, labels } = getStatusSteps(taskType);
  const currentIdx = steps.indexOf(currentStatus);
  return (
    <View style={s.flowRow}>
      {steps.map((step, i) => {
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
                {labels[i]}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[s.flowLine, i < currentIdx && s.flowLineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

const PICKUP_COLOR = '#16A34A';
const DROPOFF_COLOR = '#DC2626';
const DRIVER_COLOR = '#2563EB';
const DRIVER_OFFSET = 0.00015;
const offsetDriverCoord = (coord) => coord ? { latitude: coord.latitude + DRIVER_OFFSET, longitude: coord.longitude + DRIVER_OFFSET } : null;

const TaskTrackingScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { taskId } = route.params;
  const { triggerRating } = useRating();
  const [task, setTask]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [ratingTriggered, setRatingTriggered] = useState(false);
  const mapRef = useRef(null);
  const fittedRef = useRef(false);
  const hadDriverRef = useRef(false);
  const completedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await getTask(taskId);
      if (data?.id) {
        setTask(data);
        if (data.status === 'COMPLETED') {
          completedRef.current = true;
          if (!ratingTriggered && !alreadyRated) {
            getTaskRating(taskId).then(res => {
              if (res?.rated === false) {
                triggerRating(taskId);
                setRatingTriggered(true);
              } else if (res?.id) {
                setAlreadyRated(true);
              }
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[Tracking]', err.message);
    } finally {
      setLoading(false);
    }
  }, [taskId, ratingTriggered, alreadyRated, triggerRating]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (completedRef.current) return;
      load();
    }, 10000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!task) return;
    const coords = [];
    if (task.pickup_lat && task.pickup_lng) coords.push({ latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) });
    if (task.dropoff_lat && task.dropoff_lng) coords.push({ latitude: parseFloat(task.dropoff_lat), longitude: parseFloat(task.dropoff_lng) });
    const hasDriver = !!(task.driver_latitude && task.driver_longitude);
    if (hasDriver) coords.push({ latitude: task.driver_latitude, longitude: task.driver_longitude });
    if (coords.length > 1 && (!fittedRef.current || (hasDriver && !hadDriverRef.current))) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 80, right: 80, bottom: 260, left: 80 }, animated: true });
      }, 300);
      fittedRef.current = true;
      hadDriverRef.current = hasDriver;
    }
  }, [task]);

  const pickupCoord  = task?.pickup_lat && task?.pickup_lng ? { latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) } : null;
  const dropoffCoord = task?.dropoff_lat && task?.dropoff_lng ? { latitude: parseFloat(task.dropoff_lat), longitude: parseFloat(task.dropoff_lng) } : null;
  const driverCoord  = task?.driver_latitude && task?.driver_longitude ? offsetDriverCoord({ latitude: task.driver_latitude, longitude: task.driver_longitude }) : null;

  const cfg  = task ? (STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING) : null;
  const meta = task ? (TYPE_META[task.type] || TYPE_META.ERRAND) : null;

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Live Map */}
      <View style={s.map}>
        <MapView
          ref={mapRef}
          style={s.map}
          mapType="none"
          initialRegion={{
            latitude: 9.0192,
            longitude: 38.7578,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          <UrlTile
            urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
          {pickupCoord && (
            <Marker coordinate={pickupCoord} title="Pickup" pinColor={PICKUP_COLOR} />
          )}
          {dropoffCoord && (
            <Marker coordinate={dropoffCoord} title={task?.type === 'ERRAND' ? 'Errand' : 'Dropoff'} pinColor={DROPOFF_COLOR} />
          )}
          {driverCoord && (
            <Marker coordinate={driverCoord} title="Driver" pinColor={DRIVER_COLOR}>
              <View style={s.driverMarker}>
                <MaterialIcons name="pedal-bike" size={16} color="#fff" />
              </View>
            </Marker>
          )}
          {driverCoord && pickupCoord && (
            <Polyline
              coordinates={[driverCoord, pickupCoord]}
              strokeColor="#2563EB"
              strokeWidth={2.5}
            />
          )}
          {pickupCoord && dropoffCoord && (
            <Polyline
              coordinates={[pickupCoord, dropoffCoord]}
              strokeColor="#16A34A"
              strokeWidth={3}
            />
          )}
        </MapView>
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

            {(() => {
              const d = calcDistance(task.pickup_lat, task.pickup_lng, task.dropoff_lat, task.dropoff_lng);
              return d !== null ? (
                <View style={s.distRow}>
                  <MaterialIcons name="place" size={16} color="#6B7280" />
                  <Text style={s.distText}>{d} km</Text>
                </View>
              ) : null;
            })()}

            <View style={s.divider} />

            <Text style={s.flowTitle}>Task Progress</Text>
            <StatusFlow currentStatus={task.status} taskType={task.type} />

            {task.status === 'AWAITING_PAYMENT' && (
              <View style={[s.completedRow, { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }]}>
                <MaterialIcons name="receipt" size={18} color="#D97706" />
                <Text style={[s.completedText, { color: '#92400E' }]}>
                  Final price: {task.final_price ? `${task.final_price} ETB` : 'Calculating...'}
                </Text>
              </View>
            )}

            {task.status === 'COMPLETED' && (
              <View style={s.completedRow}>
                <MaterialIcons name="check-circle" size={18} color="#16A34A" />
                <Text style={s.completedText}>Task completed successfully!</Text>
                {task.final_price && (
                  <Text style={[s.completedText, { color: '#111827', fontWeight: '700' }]}>
                    {' — '}{task.final_price} ETB
                  </Text>
                )}
                {alreadyRated && (
                  <>
                    <View style={{ flex: 1 }} />
                    <MaterialIcons name="star" size={16} color="#F59E0B" />
                    <Text style={s.ratedText}>You rated</Text>
                  </>
                )}
              </View>
            )}

            {!['AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED'].includes(task.status) && (
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

  map: { flex: 1 },
  driverMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },

  backBtn: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },

  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 20 },

  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center' },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  driverSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  distText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },

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

  ratedText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  etaRow: { flexDirection: 'row', alignItems: 'center' },
  etaText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
});

export default TaskTrackingScreen;
