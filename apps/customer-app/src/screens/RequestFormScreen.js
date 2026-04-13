import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Reusable: Step Header ────────────────────────────────────────────────────
const StepHeader = ({ title, subtitle, current, total }) => (
  <View style={s.stepHeader}>
    <Text style={s.stepCount}>Step {current} of {total}</Text>
    <View style={s.stepBarRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[s.stepBar, i < current && s.stepBarActive]} />
      ))}
    </View>
    <Text style={s.stepTitle}>{title}</Text>
    {subtitle ? <Text style={s.stepSubtitle}>{subtitle}</Text> : null}
  </View>
);

// ─── Reusable: Option Selector (chips) ───────────────────────────────────────
const OptionSelector = ({ label, options, value, onChange }) => (
  <View style={s.fieldGroup}>
    {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
    <View style={s.chipRow}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.chip, selected && s.chipSelected]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.chipText, selected && s.chipTextSelected]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ─── Reusable: Labelled TextInput ─────────────────────────────────────────────
const Field = ({ label, placeholder, value, onChange, multiline }) => (
  <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>{label}</Text>
    <TextInput
      style={[s.input, multiline && s.inputMulti]}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChange}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
    />
  </View>
);

// ─── Reusable: Map Placeholder ────────────────────────────────────────────────
const MapPlaceholder = ({ label }) => (
  <View style={s.fieldGroup}>
    {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
    <View style={s.mapBox}>
      <MaterialIcons name="map" size={36} color="#D1D5DB" />
      <Text style={s.mapText}>Map preview</Text>
    </View>
  </View>
);

// ─── Reusable: Toggle (Yes / No) ─────────────────────────────────────────────
const YesNoToggle = ({ label, value, onChange }) => (
  <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={s.toggleRow}>
      {['Yes', 'No'].map((opt) => {
        const selected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[s.toggleBtn, selected && s.toggleBtnActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.toggleText, selected && s.toggleTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

// ─── Step renderers ───────────────────────────────────────────────────────────

const BuyStep1 = ({ data, set }) => (
  <>
    <OptionSelector
      label="Category"
      options={['Grocery', 'Food', 'Medicine', 'Electronics', 'Clothes', 'Other']}
      value={data.category}
      onChange={(v) => set('category', v)}
    />
    <Field
      label="Describe what you need"
      placeholder="e.g. 2kg tomatoes, red onions..."
      value={data.description}
      onChange={(v) => set('description', v)}
      multiline
    />
  </>
);

const BuyStep2 = ({ data, set }) => (
  <>
    <Field
      label="Where to buy"
      placeholder="Store name or area"
      value={data.whereToBuy}
      onChange={(v) => set('whereToBuy', v)}
    />
    <MapPlaceholder label="Store location" />
    <Field
      label="Delivery location"
      placeholder="Your address or drop-off point"
      value={data.deliveryLocation}
      onChange={(v) => set('deliveryLocation', v)}
    />
    <MapPlaceholder label="Delivery location preview" />
    <OptionSelector
      label="Priority"
      options={['Normal', 'Urgent']}
      value={data.priority}
      onChange={(v) => set('priority', v)}
    />
  </>
);

const PickupStep1 = ({ data, set }) => (
  <>
    <OptionSelector
      label="Item type"
      options={['Document', 'Package', 'Fragile', 'Other']}
      value={data.itemType}
      onChange={(v) => set('itemType', v)}
    />
    <OptionSelector
      label="Package size"
      options={['Small (≤2kg)', 'Medium (≤6kg)', 'Large (≤10kg)']}
      value={data.packageSize}
      onChange={(v) => set('packageSize', v)}
    />
  </>
);

const PickupStep2 = ({ data, set }) => (
  <>
    <Field
      label="Pickup location"
      placeholder="Where should we pick it up?"
      value={data.pickupLocation}
      onChange={(v) => set('pickupLocation', v)}
    />
    <MapPlaceholder label="Pickup location preview" />
    <Field
      label="Drop-off location"
      placeholder="Where should we deliver it?"
      value={data.dropoffLocation}
      onChange={(v) => set('dropoffLocation', v)}
    />
    <MapPlaceholder label="Drop-off location preview" />
    <OptionSelector
      label="Priority"
      options={['Normal', 'Urgent']}
      value={data.priority}
      onChange={(v) => set('priority', v)}
    />
  </>
);

const ErrandStep1 = ({ data, set }) => (
  <>
    <OptionSelector
      label="Task type"
      options={['Pay Bill', 'Submit Document', 'Pick Document', 'Wait in Line', 'Other']}
      value={data.taskType}
      onChange={(v) => set('taskType', v)}
    />
    <Field
      label="Describe the task"
      placeholder="Give us the details..."
      value={data.description}
      onChange={(v) => set('description', v)}
      multiline
    />
  </>
);

const ErrandStep2 = ({ data, set }) => (
  <>
    <Field
      label="Where to run the errand"
      placeholder="Location or address"
      value={data.errandLocation}
      onChange={(v) => set('errandLocation', v)}
    />
    <MapPlaceholder label="Errand location preview" />
    <YesNoToggle
      label="Do we need to pick something from you first?"
      value={data.needsPickup}
      onChange={(v) => set('needsPickup', v)}
    />
    {data.needsPickup === 'Yes' && (
      <>
        <Field
          label="Your pickup location"
          placeholder="Current location"
          value={data.pickupLocation}
          onChange={(v) => set('pickupLocation', v)}
        />
        <MapPlaceholder label="Pickup map preview" />
      </>
    )}
    <OptionSelector
      label="Priority"
      options={['Normal', 'Urgent']}
      value={data.priority}
      onChange={(v) => set('priority', v)}
    />
  </>
);

// ─── Config per service type ──────────────────────────────────────────────────
const SERVICE_CONFIG = {
  buy: {
    label: 'Buy Something',
    totalSteps: 2,
    stepTitles: ['What do you need?', 'Delivery details'],
    stepSubtitles: ['Choose a category and describe your order', 'Tell us where to buy and deliver'],
    validate: (step, data) => {
      if (step === 1) return data.category && data.description?.trim();
      if (step === 2) return data.whereToBuy?.trim() && data.deliveryLocation?.trim() && data.priority;
      return true;
    },
  },
  pickup: {
    label: 'Pick & Drop',
    totalSteps: 2,
    stepTitles: ['Package details', 'Locations & priority'],
    stepSubtitles: ['What are we picking up?', 'Where from and where to?'],
    validate: (step, data) => {
      if (step === 1) return data.itemType && data.packageSize;
      if (step === 2) return data.pickupLocation?.trim() && data.dropoffLocation?.trim() && data.priority;
      return true;
    },
  },
  errand: {
    label: 'Run Errand',
    totalSteps: 2,
    stepTitles: ['Task details', 'Location & logistics'],
    stepSubtitles: ['What do you need done?', 'Where and how should we handle it?'],
    validate: (step, data) => {
      if (step === 1) return data.taskType && data.description?.trim();
      if (step === 2) {
        if (!data.errandLocation?.trim() || !data.priority) return false;
        if (data.needsPickup === 'Yes' && !data.pickupLocation?.trim()) return false;
        return true;
      }
      return true;
    },
  },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RequestFormScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const serviceType = route?.params?.serviceType ?? 'buy'; // 'buy' | 'pickup' | 'errand'
  const config = SERVICE_CONFIG[serviceType];

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});

  const set = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleNext = () => {
    if (!config.validate(step, formData)) {
      Alert.alert('Required', 'Please fill in all required fields before continuing.');
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((s) => s - 1);
  };

  const handleSubmit = () => {
    if (!config.validate(step, formData)) {
      Alert.alert('Required', 'Please fill in all required fields.');
      return;
    }
    console.log('📦 Form submitted:', { serviceType, ...formData });
    Alert.alert('Request Submitted!', 'We\'ll find you a worker right away.', [
      { text: 'OK', onPress: () => navigation.navigate('Home') },
    ]);
  };

  const renderStep = () => {
    if (serviceType === 'buy') {
      return step === 1
        ? <BuyStep1 data={formData} set={set} />
        : <BuyStep2 data={formData} set={set} />;
    }
    if (serviceType === 'pickup') {
      return step === 1
        ? <PickupStep1 data={formData} set={set} />
        : <PickupStep2 data={formData} set={set} />;
    }
    if (serviceType === 'errand') {
      return step === 1
        ? <ErrandStep1 data={formData} set={set} />
        : <ErrandStep2 data={formData} set={set} />;
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{config.label}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepHeader
          current={step}
          total={config.totalSteps}
          title={config.stepTitles[step - 1]}
          subtitle={config.stepSubtitles[step - 1]}
        />

        <View style={s.formCard}>
          {renderStep()}
        </View>
      </ScrollView>

      {/* Bottom action buttons */}
      <View style={[s.bottomBar, { paddingBottom: insets.bottom || 16 }]}>
        <TouchableOpacity style={s.btnSecondary} onPress={handleBack} activeOpacity={0.8}>
          <Text style={s.btnSecondaryText}>{step === 1 ? 'Cancel' : 'Back'}</Text>
        </TouchableOpacity>

        {step < config.totalSteps ? (
          <TouchableOpacity style={s.btnPrimary} onPress={handleNext} activeOpacity={0.8}>
            <Text style={s.btnPrimaryText}>Next</Text>
            <MaterialIcons name="arrow-forward" size={18} color="white" style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit} activeOpacity={0.8}>
            <MaterialIcons name="check-circle" size={18} color="white" style={{ marginRight: 6 }} />
            <Text style={s.btnPrimaryText}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: '#F9FAFB',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  // Scroll
  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  // Step header
  stepHeader: { marginBottom: 24 },
  stepCount: { fontSize: 12, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  stepBarRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  stepBarActive: { backgroundColor: '#16A34A' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: '#6B7280' },

  // Form card
  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 20, gap: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },

  // Field
  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { height: 88, textAlignVertical: 'top' },

  // Chips
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  chipSelected: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextSelected: { color: '#16A34A' },

  // Map placeholder
  mapBox: {
    height: 140, borderRadius: 14, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 8,
  },
  mapText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  // Toggle
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  toggleBtnActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#16A34A' },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 10,
  },
  btnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 15,
  },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  btnSecondary: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  btnSecondaryText: { color: '#374151', fontSize: 15, fontWeight: '600' },
});

export default RequestFormScreen;
