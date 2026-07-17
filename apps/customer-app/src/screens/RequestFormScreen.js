import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { apiPost } from '../services/authService';
import LocationPicker from '../components/LocationPicker';

const ADDIS_LAT = 9.0192;
const ADDIS_LNG = 38.7578;

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
    <LocationPicker
      label="Store location (where to buy)"
      initialLat={data.storeLat}
      initialLng={data.storeLng}
      address={data.storeAddress}
      expandable
      onLocationChange={(lat, lng, addr) => {
        set('storeLat', lat);
        set('storeLng', lng);
        set('storeAddress', addr);
      }}
    />
    <LocationPicker
      label="Delivery location (where to drop off)"
      initialLat={data.deliveryLat}
      initialLng={data.deliveryLng}
      address={data.deliveryAddress}
      expandable
      onLocationChange={(lat, lng, addr) => {
        set('deliveryLat', lat);
        set('deliveryLng', lng);
        set('deliveryAddress', addr);
      }}
    />
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
    <LocationPicker
      label="Pickup location"
      initialLat={data.pickupLat}
      initialLng={data.pickupLng}
      address={data.pickupAddress}
      expandable
      onLocationChange={(lat, lng, addr) => {
        set('pickupLat', lat);
        set('pickupLng', lng);
        set('pickupAddress', addr);
      }}
    />
    <LocationPicker
      label="Drop-off location"
      initialLat={data.dropoffLat}
      initialLng={data.dropoffLng}
      address={data.dropoffAddress}
      expandable
      onLocationChange={(lat, lng, addr) => {
        set('dropoffLat', lat);
        set('dropoffLng', lng);
        set('dropoffAddress', addr);
      }}
    />
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
    <LocationPicker
      label="Errand location"
      initialLat={data.errandLat}
      initialLng={data.errandLng}
      address={data.errandAddress}
      expandable
      onLocationChange={(lat, lng, addr) => {
        set('errandLat', lat);
        set('errandLng', lng);
        set('errandAddress', addr);
      }}
    />
    <YesNoToggle
      label="Do we need to pick something from you first?"
      value={data.needsPickup}
      onChange={(v) => set('needsPickup', v)}
    />
    {data.needsPickup === 'Yes' && (
      <LocationPicker
        label="Your pickup location"
        initialLat={data.pickupLat2}
        initialLng={data.pickupLng2}
        address={data.pickupAddress2}
        expandable
        onLocationChange={(lat, lng, addr) => {
          set('pickupLat2', lat);
          set('pickupLng2', lng);
          set('pickupAddress2', addr);
        }}
      />
    )}
    <OptionSelector
      label="Priority"
      options={['Normal', 'Urgent']}
      value={data.priority}
      onChange={(v) => set('priority', v)}
    />
  </>
);

// ─── Haversine + pricing ──────────────────────────────────────────────────────
const calcDistance = (lat1, lng1, lat2, lng2) => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 100) / 100;
};

const calcEstimatedPrice = (serviceType, data) => {
  let lat1, lng1, lat2, lng2;
  if (serviceType === 'buy') {
    lat1 = data.storeLat; lng1 = data.storeLng;
    lat2 = data.deliveryLat; lng2 = data.deliveryLng;
  } else if (serviceType === 'pickup') {
    lat1 = data.pickupLat; lng1 = data.pickupLng;
    lat2 = data.dropoffLat; lng2 = data.dropoffLng;
  } else {
    lat2 = data.errandLat; lng2 = data.errandLng;
    if (data.needsPickup === 'Yes') {
      lat1 = data.pickupLat2; lng1 = data.pickupLng2;
    } else {
      lat1 = lat2; lng1 = lng2;
    }
  }
  const dist = calcDistance(lat1, lng1, lat2, lng2);

  let price;
  if (serviceType === 'errand' && dist < 0.01) {
    price = 30;
  } else if (serviceType === 'errand') {
    price = 30 + Math.round(dist * 20);
  } else {
    const sizePremiumMap = { 'Small (≤2kg)': 10, 'Medium (≤6kg)': 20, 'Large (≤10kg)': 30 };
    const sizePremium = sizePremiumMap[data.packageSize] || 0;
    const distanceCharge = dist <= 1 ? 30 : 30 + Math.ceil(dist - 1) * 10;
    price = distanceCharge + sizePremium;
  }

  if (data.priority === 'Urgent') {
    price = Math.ceil(price * 1.2);
  }
  return price;
};

// ─── Preview Step ─────────────────────────────────────────────────────────────
const PreviewStep = ({ serviceType, data }) => {
  const Row = ({ label, value }) => (
    value ? (
      <View style={s.previewRow}>
        <Text style={s.previewLabel}>{label}</Text>
        <Text style={s.previewValue}>{value}</Text>
      </View>
    ) : null
  );

  const fields = [];
  if (serviceType === 'buy') {
    fields.push({ label: 'Category', value: data.category });
    fields.push({ label: 'Description', value: data.description });
    fields.push({ label: 'Store location', value: data.storeAddress });
    fields.push({ label: 'Delivery location', value: data.deliveryAddress });
  } else if (serviceType === 'pickup') {
    fields.push({ label: 'Item type', value: data.itemType });
    fields.push({ label: 'Package size', value: data.packageSize });
    fields.push({ label: 'Pickup location', value: data.pickupAddress });
    fields.push({ label: 'Drop-off location', value: data.dropoffAddress });
  } else if (serviceType === 'errand') {
    fields.push({ label: 'Task type', value: data.taskType });
    fields.push({ label: 'Description', value: data.description });
    fields.push({ label: 'Errand location', value: data.errandAddress });
    if (data.needsPickup === 'Yes') {
      fields.push({ label: 'Needs pickup', value: 'Yes' });
      fields.push({ label: 'Pickup location', value: data.pickupAddress2 });
    }
  }
  fields.push({ label: 'Priority', value: data.priority });

  const rawPrice = calcEstimatedPrice(serviceType, data);
  const estimatedPrice = rawPrice ? `${rawPrice} ETB` : null;
  const estimatedDist = (() => {
    let lat1, lng1, lat2, lng2;
    if (serviceType === 'buy') {
      lat1 = data.storeLat; lng1 = data.storeLng;
      lat2 = data.deliveryLat; lng2 = data.deliveryLng;
    } else if (serviceType === 'pickup') {
      lat1 = data.pickupLat; lng1 = data.pickupLng;
      lat2 = data.dropoffLat; lng2 = data.dropoffLng;
    } else {
      lat2 = data.errandLat; lng2 = data.errandLng;
      if (data.needsPickup === 'Yes') {
        lat1 = data.pickupLat2; lng1 = data.pickupLng2;
      } else {
        lat1 = lat2; lng1 = lng2;
      }
    }
    const d = calcDistance(lat1, lng1, lat2, lng2);
    return d > 0 ? `${d} km` : null;
  })();

  return (
    <View style={s.previewCard}>
      {fields.map((f, i) => <Row key={i} label={f.label} value={f.value} />)}
      <View style={s.previewDivider} />
      {estimatedDist && <Row label="Distance" value={estimatedDist} />}
      {estimatedPrice && <Row label="Estimated price" value={estimatedPrice} />}
    </View>
  );
};

// ─── Config per service type ──────────────────────────────────────────────────
const SERVICE_CONFIG = {
  buy: {
    label: 'Buy Something',
    totalSteps: 3,
    stepTitles: ['What do you need?', 'Delivery details', 'Review & Confirm'],
    stepSubtitles: ['Choose a category and describe your order', 'Tell us where to buy and deliver', 'Check everything before submitting'],
    validate: (step, data) => {
      if (step === 1) return data.category && data.description?.trim();
      if (step === 2) return data.storeLat && data.deliveryLat && data.priority;
      return true;
    },
  },
  pickup: {
    label: 'Pick & Drop',
    totalSteps: 3,
    stepTitles: ['Package details', 'Locations & priority', 'Review & Confirm'],
    stepSubtitles: ['What are we picking up?', 'Where from and where to?', 'Check everything before submitting'],
    validate: (step, data) => {
      if (step === 1) return data.itemType && data.packageSize;
      if (step === 2) return data.pickupLat && data.dropoffLat && data.priority;
      return true;
    },
  },
  errand: {
    label: 'Run Errand',
    totalSteps: 3,
    stepTitles: ['Task details', 'Location & logistics', 'Review & Confirm'],
    stepSubtitles: ['What do you need done?', 'Where and how should we handle it?', 'Check everything before submitting'],
    validate: (step, data) => {
      if (step === 1) return data.taskType && data.description?.trim();
      if (step === 2) {
        if (!data.errandLat || !data.priority) return false;
        if (data.needsPickup === 'Yes' && !data.pickupLat2) return false;
        return true;
      }
      return true;
    },
  },
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const RequestFormScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const serviceType = route?.params?.serviceType ?? 'buy';
  const config = SERVICE_CONFIG[serviceType];

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const set = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const TYPE_MAP = { buy: 'SHOPPING', pickup: 'DELIVERY', errand: 'ERRAND' };
  const SIZE_MAP = { 'Small (≤2kg)': 'up_to_2kg', 'Medium (≤6kg)': 'up_to_6kg', 'Large (≤10kg)': 'up_to_10kg' };
  const PRIORITY_MAP = { 'Normal': 'normal', 'Urgent': 'urgent' };

  const buildNote = () => {
    const parts = [];
    if (formData.category)         parts.push(`Category: ${formData.category}`);
    if (formData.description)      parts.push(formData.description);
    if (formData.taskType)         parts.push(`Task: ${formData.taskType}`);
    if (formData.itemType)         parts.push(`Item: ${formData.itemType}`);
    if (formData.packageSize)      parts.push(`Size: ${formData.packageSize}`);
    return parts.join(' | ');
  };

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

  const handleSubmit = async () => {
    if (!config.validate(step, formData)) {
      Alert.alert('Required', 'Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      let pickup_lat, pickup_lng, dropoff_lat, dropoff_lng;

      if (serviceType === 'buy') {
        pickup_lat = formData.storeLat ?? ADDIS_LAT;
        pickup_lng = formData.storeLng ?? ADDIS_LNG;
        dropoff_lat = formData.deliveryLat ?? ADDIS_LAT;
        dropoff_lng = formData.deliveryLng ?? ADDIS_LNG;
      } else if (serviceType === 'pickup') {
        pickup_lat = formData.pickupLat ?? ADDIS_LAT;
        pickup_lng = formData.pickupLng ?? ADDIS_LNG;
        dropoff_lat = formData.dropoffLat ?? ADDIS_LAT;
        dropoff_lng = formData.dropoffLng ?? ADDIS_LNG;
      } else {
        dropoff_lat = formData.errandLat ?? ADDIS_LAT;
        dropoff_lng = formData.errandLng ?? ADDIS_LNG;
        pickup_lat = formData.needsPickup === 'Yes'
          ? (formData.pickupLat2 ?? ADDIS_LAT)
          : dropoff_lat;
        pickup_lng = formData.needsPickup === 'Yes'
          ? (formData.pickupLng2 ?? ADDIS_LNG)
          : dropoff_lng;
      }

      const r6 = (v) => Number(Number(v).toFixed(6));

      const payload = {
        type: TYPE_MAP[serviceType],
        pickup_lat: r6(pickup_lat),
        pickup_lng: r6(pickup_lng),
        dropoff_lat: r6(dropoff_lat),
        dropoff_lng: r6(dropoff_lng),
        priority: PRIORITY_MAP[formData.priority] || 'normal',
        item_size: serviceType === 'pickup' ? (SIZE_MAP[formData.packageSize] || null) : null,
        pickup_address: formData.storeAddress || formData.pickupAddress || formData.pickupAddress2 || '',
        dropoff_address: formData.deliveryAddress || formData.dropoffAddress || formData.errandAddress || '',
        note: buildNote(),
      };
      console.log('[Submit] payload:', JSON.stringify(payload));
      const result = await apiPost('/tasks/', payload);
      console.log('[Submit] response:', JSON.stringify(result));
      if (result?.id) {
        Alert.alert('Request Submitted!', "We'll find you a worker right away.", [
          { text: 'OK', onPress: () => navigation.navigate('TaskList') },
        ]);
      } else {
        const serverMsg = typeof result === 'object' ? JSON.stringify(result) : result;
        Alert.alert('Error', serverMsg || 'Failed to submit request. Please try again.');
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (step === 3) return <PreviewStep serviceType={serviceType} data={formData} />;
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
          <TouchableOpacity style={s.btnPrimary} onPress={handleSubmit} activeOpacity={0.8} disabled={submitting}>
            {submitting
              ? <ActivityIndicator color="white" />
              : <>
                  <MaterialIcons name="check-circle" size={18} color="white" style={{ marginRight: 6 }} />
                  <Text style={s.btnPrimaryText}>Submit</Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 56, backgroundColor: '#F9FAFB',
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },

  scroll: { paddingHorizontal: 20, paddingTop: 20 },

  stepHeader: { marginBottom: 24 },
  stepCount: { fontSize: 12, fontWeight: '700', color: '#16A34A', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  stepBarRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  stepBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  stepBarActive: { backgroundColor: '#16A34A' },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#111827', marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: '#6B7280' },

  formCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20,
    padding: 20, gap: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 12, elevation: 2,
  },

  fieldGroup: { gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  input: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA',
  },
  inputMulti: { height: 88, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA',
  },
  chipSelected: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextSelected: { color: '#16A34A' },

  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  toggleBtnActive: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#16A34A' },

  previewCard: { gap: 0 },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  previewLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  previewValue: { fontSize: 14, color: '#111827', fontWeight: '600', flex: 1, textAlign: 'right' },
  previewDivider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 },

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
