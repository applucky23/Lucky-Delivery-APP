import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { MOCK_TASKS, STATUS_CONFIG, STATUS_FLOW, STATUS_FLOW_LABELS } from '../data/mockTasks';

// ── Reusable section card ─────────────────────────────────────────────────────
const SectionCard = ({ title, children }) => (
  <View style={s.card}>
    {title ? <Text style={s.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

// ── Location row ──────────────────────────────────────────────────────────────
const LocationRow = ({ label, address }) => (
  <View style={s.locationRow}>
    <View style={s.locationIcon}>
      <MaterialIcons name="location-on" size={16} color="#16A34A" />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.locationLabel}>{label}</Text>
      <Text style={s.locationAddress}>{address}</Text>
    </View>
  </View>
);

// ── Status flow indicator ─────────────────────────────────────────────────────
const StatusFlow = ({ currentStatus }) => {
  const currentIdx = STATUS_FLOW.indexOf(currentStatus);
  return (
    <View style={s.flowRow}>
      {STATUS_FLOW_LABELS.map((label, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        return (
          <React.Fragment key={label}>
            <View style={s.flowStep}>
              <View style={[s.flowDot,
                done   && s.flowDotDone,
                active && s.flowDotActive,
              ]}>
                {done && <MaterialIcons name="check" size={10} color="#fff" />}
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

// ── Price row ─────────────────────────────────────────────────────────────────
const PriceRow = ({ label, amount, total }) => (
  <View style={[s.priceRow, total && s.priceRowTotal]}>
    <Text style={[s.priceLabel, total && s.priceLabelTotal]}>{label}</Text>
    <View style={s.priceDots} />
    <Text style={[s.priceAmount, total && s.priceAmountTotal]}>{amount} ETB</Text>
  </View>
);

// ── Driver card ───────────────────────────────────────────────────────────────
const DriverInfoCard = ({ driver, status }) => (
  <SectionCard title="Worker">
    <View style={s.driverRow}>
      <View style={s.driverAvatar}>
        <Text style={s.driverAvatarText}>{driver.name.charAt(0)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.driverName}>{driver.name}</Text>
        <View style={s.driverMeta}>
          <MaterialIcons name="star" size={13} color="#F59E0B" />
          <Text style={s.driverRating}>{driver.rating}</Text>
          <Text style={s.driverPhone}>{driver.phone}</Text>
        </View>
      </View>
      <View style={[s.driverStatusBadge, { backgroundColor: STATUS_CONFIG[status].bg }]}>
        <Text style={[s.driverStatusText, { color: STATUS_CONFIG[status].color }]}>
          {STATUS_CONFIG[status].label}
        </Text>
      </View>
    </View>
  </SectionCard>
);

// ── Screen ────────────────────────────────────────────────────────────────────
const TaskDetailScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { taskId } = route.params;
  const task = MOCK_TASKS.find(t => t.id === taskId);
  if (!task) return null;

  const isActive = task.status !== 'completed';
  const total = task.pricing.deliveryFee + task.pricing.extras + task.pricing.serviceCharge;

  const renderLocations = () => {
    if (task.type === 'buy') return (
      <>
        <LocationRow label="Store Location" address={task.storeLocation} />
        <View style={s.locationDivider} />
        <LocationRow label="Delivery Location" address={task.deliveryLocation} />
      </>
    );
    if (task.type === 'pickup') return (
      <>
        <LocationRow label="Pickup Location" address={task.pickupLocation} />
        <View style={s.locationDivider} />
        <LocationRow label="Drop-off Location" address={task.dropoffLocation} />
      </>
    );
    return <LocationRow label="Errand Location" address={task.errandLocation} />;
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Task Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Task Info */}
        <SectionCard title="Task Info">
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Type</Text>
            <Text style={s.infoValue}>{task.typeLabel}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Description</Text>
            <Text style={[s.infoValue, { flex: 1, textAlign: 'right' }]}>{task.description}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Priority</Text>
            <View style={[s.priorityBadge, task.priority === 'Urgent' && s.priorityUrgent]}>
              <Text style={[s.priorityText, task.priority === 'Urgent' && s.priorityTextUrgent]}>
                {task.priority}
              </Text>
            </View>
          </View>
          <View style={[s.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={s.infoLabel}>Created</Text>
            <Text style={s.infoValue}>{task.createdAt}</Text>
          </View>
        </SectionCard>

        {/* Locations */}
        <SectionCard title="Locations">
          {renderLocations()}
        </SectionCard>

        {/* Driver */}
        {task.driver && <DriverInfoCard driver={task.driver} status={task.status} />}

        {/* Status Flow */}
        <SectionCard title="Status">
          <StatusFlow currentStatus={task.status} />
        </SectionCard>

        {/* Pricing */}
        <SectionCard title="Pricing">
          <PriceRow label="Delivery Fee" amount={task.pricing.deliveryFee} />
          {task.pricing.extras > 0 && <PriceRow label="Extras" amount={task.pricing.extras} />}
          <PriceRow label="Service Charge" amount={task.pricing.serviceCharge} />
          <View style={s.priceDivider} />
          <PriceRow label="Total" amount={total} total />
        </SectionCard>
      </ScrollView>

      {/* Track button */}
      {isActive && task.driver && (
        <View style={[s.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity
            style={s.trackBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('TaskTracking', { taskId: task.id })}
          >
            <MaterialIcons name="my-location" size={18} color="#fff" />
            <Text style={s.trackBtnText}>Track Task</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#F9FAFB',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },

  // Info rows
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  infoLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: '600' },

  // Priority badge
  priorityBadge: { backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  priorityUrgent: { backgroundColor: '#FEF2F2' },
  priorityText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  priorityTextUrgent: { color: '#EF4444' },

  // Locations
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  locationIcon: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: '#F0FDF4',
    justifyContent: 'center', alignItems: 'center', marginTop: 2,
  },
  locationLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  locationAddress: { fontSize: 13, color: '#111827', fontWeight: '600' },
  locationDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4, marginLeft: 38 },

  // Driver
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  driverName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  driverMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  driverRating: { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  driverPhone: { fontSize: 12, color: '#6B7280', marginLeft: 6 },
  driverStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  driverStatusText: { fontSize: 11, fontWeight: '700' },

  // Status flow
  flowRow: { flexDirection: 'row', alignItems: 'center' },
  flowStep: { alignItems: 'center', gap: 6 },
  flowDot: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#E5E7EB', backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  flowDotDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  flowDotActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  flowLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginBottom: 18 },
  flowLineDone: { backgroundColor: '#16A34A' },
  flowLabel: { fontSize: 9, color: '#9CA3AF', fontWeight: '600',
    textTransform: 'uppercase', textAlign: 'center', maxWidth: 52 },
  flowLabelActive: { color: '#16A34A' },

  // Pricing
  priceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  priceRowTotal: { paddingTop: 12 },
  priceLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  priceLabelTotal: { fontSize: 14, color: '#111827', fontWeight: '700' },
  priceDots: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    borderStyle: 'dashed', marginHorizontal: 8, marginBottom: 2 },
  priceAmount: { fontSize: 13, color: '#111827', fontWeight: '600' },
  priceAmountTotal: { fontSize: 15, color: '#16A34A', fontWeight: '800' },
  priceDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 4 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 10,
  },
  trackBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 15,
  },
  trackBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

export default TaskDetailScreen;
