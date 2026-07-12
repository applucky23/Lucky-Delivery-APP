import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, Image, ScrollView, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert, Linking, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { UrlTile, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { getTaskDetail, getActiveTask, markArrived, submitItemAmount, startDelivery, completeTask, confirmPayment, updateDriverLocation, verifyReceipt, uploadImage, doneShopping, arriveAtDropoff } from '../services/driverService';
import * as ImagePicker from 'expo-image-picker';

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
// DELIVERY skips approval (no item cost), SHOPPING/ERRAND require it
const getNextAction = (task) => {
  if (!task) return null;
  const actions = {
    ASSIGNED:          { action: 'mark_arrived',     label: "I've Arrived",        icon: 'place',            color: C.tertiary,  bg: C.secondaryC },
    DELIVERING:        { action: 'complete_task',    label: 'Complete Delivery',   icon: 'check-circle',     color: C.primaryC,  bg: '#dcfce7'    },
    AWAITING_PAYMENT:  { action: 'confirm_payment',  label: 'Done & Paid',         icon: 'done-all',         color: C.primary,   bg: '#dcfce7'    },
    COMPLETED:         null,
  };
  if (task.status === 'ARRIVED') {
    if (task.type === 'ERRAND' && (task.estimated_distance_km || 0) > 0) {
      if (task.arrived_at_dropoff_at)
        return { action: 'start_delivery',   label: 'Complete Errand',  icon: 'check-circle', color: C.primaryC, bg: '#dcfce7' };
      return { action: 'arrive_at_dropoff', label: "Arrived at Errand Place", icon: 'place', color: C.tertiary, bg: C.secondaryC };
    }
    if (task.type === 'ERRAND')
      return { action: 'start_delivery',   label: 'Complete Errand',  icon: 'check-circle',   color: C.primaryC, bg: '#dcfce7' };
    if (task.type === 'DELIVERY')
      return { action: 'start_delivery',   label: 'Complete Delivery',   icon: 'check-circle', color: C.primaryC, bg: '#dcfce7' };
    return { action: 'request_approval', label: 'Submit Price',  icon: 'payment', color: C.warning, bg: C.warningC };
  }
  if (task.status === 'PURCHASED') {
    if (task.has_receipt)
      return { action: 'done_shopping', label: 'Done Shopping', icon: 'shopping-cart', color: C.primaryC, bg: '#dcfce7' };
    return { action: 'upload_receipt', label: 'Upload Receipt', icon: 'camera-alt', color: C.warning, bg: C.warningC };
  }
  const next = actions[task.status] || null;
  console.log(`[getNextAction] status=${task.status} type=${task.type} → action=${next?.action} label=${next?.label}`);
  return next;
};

const ACTION_API = {
  mark_arrived:     (id) => markArrived(id),
  start_delivery:   (id) => startDelivery(id),
  complete_task:    (id) => completeTask(id),
  request_approval: (id, amount) => submitItemAmount(id, amount),
  confirm_payment:  (id) => confirmPayment(id),
  done_shopping:    (id) => doneShopping(id),
  arrive_at_dropoff: (id) => arriveAtDropoff(id),
};

const getStatusSteps = (type) => {
  if (type === 'SHOPPING') return { steps: ['ASSIGNED', 'ARRIVED', 'PURCHASED', 'DELIVERING', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Assigned', 'Arrived', 'Purchased', 'Delivering', 'Payment', 'Done'] };
  if (type === 'ERRAND') return { steps: ['ASSIGNED', 'ARRIVED', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Assigned', 'Arrived', 'Payment', 'Done'] };
  return { steps: ['ASSIGNED', 'ARRIVED', 'AWAITING_PAYMENT', 'COMPLETED'], labels: ['Assigned', 'Arrived', 'Payment', 'Done'] };
};

const TYPE_META = {
  DELIVERY: { icon: 'local-shipping', color: C.tertiaryC,  text: '#003d88' },
  SHOPPING: { icon: 'shopping-bag',   color: C.secondaryC, text: '#5c647a' },
  ERRAND:   { icon: 'assignment',     color: C.surfaceCH,  text: C.onSurfaceV },
};

export default function DriverActiveTaskScreen({ navigation, route }) {
  const taskId = route?.params?.taskId ?? null;
  const [task, setTask]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [actioning, setActioning]   = useState(false);
  const [showAmount, setShowAmount] = useState(false);
  const [amount, setAmount]         = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptImage, setReceiptImage] = useState(null);
  const [receiptType, setReceiptType] = useState('receipt');
  const [uploading, setUploading]   = useState(false);
  const [driverPos, setDriverPos]   = useState(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const mapRef = useRef(null);
  const fittedRef = useRef(false);
  const hadDriverRef = useRef(false);
  const DRIVER_OFFSET = 0.00015;
  const offsetDriverPos = (pos) => pos ? { latitude: pos.latitude + DRIVER_OFFSET, longitude: pos.longitude + DRIVER_OFFSET } : null;

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

  useEffect(() => {
    let subscription;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (location) => {
          const { latitude, longitude } = location.coords;
          setDriverPos({ latitude, longitude });
        },
      );
    })();
    return () => {
      if (subscription) subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!task) return;
    const coords = [];
    if (task.pickup_lat && task.pickup_lng) coords.push({ latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) });
    if (task.dropoff_lat && task.dropoff_lng) coords.push({ latitude: parseFloat(task.dropoff_lat), longitude: parseFloat(task.dropoff_lng) });
    if (driverPos) coords.push(offsetDriverPos(driverPos));

    const hasDriver = driverPos !== null;
    if (coords.length > 1 && (!fittedRef.current || (hasDriver && !hadDriverRef.current))) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
      }, 500);
      fittedRef.current = true;
      hadDriverRef.current = hasDriver;
    }
  }, [task, driverPos]);

  const getCurrentPos = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return pos.coords;
    } catch {
      return null;
    }
  };

  const sendCurrentLocation = async () => {
    try {
      const coords = await getCurrentPos();
      if (!coords) return false;
      await updateDriverLocation(coords.latitude, coords.longitude);
      return true;
    } catch {
      return false;
    }
  };

  const handleAction = async (action) => {
    console.log(`[handleAction] action=${action} task.id=${task?.id} task.status=${task?.status} task.type=${task?.type}`);
    if (!task) return;

    if (action === 'request_approval') {
      return handleRequestApproval();
    }
    if (action === 'upload_receipt') {
      return handleUploadReceipt();
    }

    setActioning(true);
    try {
      if (action === 'mark_arrived') {
        await sendCurrentLocation();
        if (driverPos && task?.pickup_lat && task?.pickup_lng) {
          const toRad = (d) => d * Math.PI / 180;
          const R = 6371e3;
          const dLat = toRad(parseFloat(task.pickup_lat) - driverPos.latitude);
          const dLon = toRad(parseFloat(task.pickup_lng) - driverPos.longitude);
          const a = Math.sin(dLat/2)**2 + Math.cos(toRad(driverPos.latitude)) * Math.cos(toRad(parseFloat(task.pickup_lat))) * Math.sin(dLon/2)**2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          if (dist > 300) {
            const confirmed = await new Promise((resolve) => {
              Alert.alert(
                'Far from pickup',
                'You appear to be far from the pickup location. Are you sure you arrived?',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: "Yes, I'm sure", onPress: () => resolve(true) },
                ]
              );
            });
            if (!confirmed) { setActioning(false); return; }
          }
        }
      }
      const apiFn = ACTION_API[action];
      if (!apiFn) {
        Alert.alert('Notice', 'Coming soon.');
        setActioning(false);
        return;
      }
      const result = await apiFn(task.id);
      console.log(`[handleAction] result=`, result, `nextAction=`, getNextAction({...task, ...result}));
      if (result?.message || result?.id) {
        const updated = await getTaskDetail(task.id);
        console.log(`[handleAction] refreshed task status=${updated?.status} has_receipt=${updated?.has_receipt}`);
        if (updated?.id) setTask(updated);
        if (action === 'complete_task') {
          // Step 1 — delivery done, awaiting payment confirmation
        }
        if (action === 'confirm_payment') {
          Alert.alert('Done & Paid', 'Payment confirmed. Task completed!', [
            { text: 'OK', onPress: () => navigation.navigate('DriverHome') },
          ]);
        }
      } else {
        Alert.alert('Error', result?.error || 'Could not update task status.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleRequestApproval = () => {
    setAmount('');
    setShowAmount(true);
  };

  const submitAmount = async () => {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      Alert.alert('Invalid', 'Please enter a valid amount.');
      return;
    }
    setShowAmount(false);
    setActioning(true);
    try {
      const result = await submitItemAmount(task.id, num);
      if (result?.message || result?.id) {
        const updated = await getTaskDetail(task.id);
        if (updated?.id) setTask(updated);
      } else {
        Alert.alert('Error', result?.error || 'Could not submit amount.');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActioning(false);
    }
  };

  const handleUploadReceipt = () => {
    setReceiptImage(null);
    setReceiptType('receipt');
    setShowReceipt(true);
  };

  const pickReceipt = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to upload receipts.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      setReceiptImage(result.assets[0]);
    }
  };

  const uploadReceipt = async () => {
    if (!receiptImage) {
      Alert.alert('Select image', 'Please pick a receipt image first.');
      return;
    }
    setUploading(true);
    try {
      const imageUrl = await uploadImage(receiptImage.uri, 'Receipt Verifications', `receipt-${task.id}-${Date.now()}.jpg`);
      if (!imageUrl) {
        Alert.alert('Upload failed', 'Could not upload the image. Please try again.');
        setUploading(false);
        return;
      }
      const result = await verifyReceipt(task.id, imageUrl, receiptType);
      if (result?.success || result?.message) {
        setShowReceipt(false);
        setReceiptImage(null);
        Alert.alert('Receipt uploaded', 'Receipt uploaded. Will be cross-checked by admin.');
        const updated = await getTaskDetail(task.id);
        if (updated?.id) setTask(updated);
      } else {
        Alert.alert('Error', result?.error || 'Could not verify receipt.');
      }
    } catch (err) {
      if (err.message && err.message.includes('Verification failed')) {
        setShowReceipt(false);
        Alert.alert('Verification failed', err.message);
        const updated = await getTaskDetail(task.id);
        if (updated?.id) setTask(updated);
      } else {
        Alert.alert('Error', err.message || 'An error occurred');
      }
    } finally {
      setUploading(false);
    }
  };

  const { steps: STATUS_STEPS, labels: STATUS_LABELS } = task ? getStatusSteps(task.type) : getStatusSteps('DELIVERY');
  const stepIndex   = task ? STATUS_STEPS.indexOf(task.status) : -1;
  const nextAction  = getNextAction(task);
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

      {/* Live Map */}
      <View style={[s.mapBox, mapExpanded && s.mapBoxExpanded]}>
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
          {task && task.pickup_lat && task.pickup_lng && (
            <Marker
              coordinate={{ latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) }}
              title="Pickup"
              pinColor="#16A34A"
            />
          )}
          {task && task.dropoff_lat && task.dropoff_lng && (
            <Marker
              coordinate={{ latitude: parseFloat(task.dropoff_lat), longitude: parseFloat(task.dropoff_lng) }}
              title={task.type === 'ERRAND' ? 'Errand' : 'Dropoff'}
              pinColor="#DC2626"
            />
          )}
          {driverPos && (
            <Marker coordinate={offsetDriverPos(driverPos)} title="You" pinColor="#2563EB">
              <View style={s.driverMarkerView}>
                <MaterialIcons name="pedal-bike" size={16} color="#fff" />
              </View>
            </Marker>
          )}
          {driverPos && task && task.pickup_lat && task.pickup_lng && (
            <Polyline
              coordinates={[
                offsetDriverPos(driverPos),
                { latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) },
              ]}
              strokeColor="#2563EB"
              strokeWidth={2.5}
            />
          )}
          {task && task.pickup_lat && task.pickup_lng && task.dropoff_lat && task.dropoff_lng && (
            <Polyline
              coordinates={[
                { latitude: parseFloat(task.pickup_lat), longitude: parseFloat(task.pickup_lng) },
                { latitude: parseFloat(task.dropoff_lat), longitude: parseFloat(task.dropoff_lng) },
              ]}
              strokeColor="#16A34A"
              strokeWidth={3}
            />
          )}
        </MapView>
        <View style={s.gpsBadge}>
          <View style={s.gpsDot} />
          <Text style={s.gpsText}>GPS Active</Text>
        </View>
        <TouchableOpacity
          style={s.mapToggleBtn}
          onPress={() => setMapExpanded(prev => !prev)}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={mapExpanded ? 'fullscreen-exit' : 'fullscreen'}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>
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
              {task.item_size && <Text style={s.sizeBadge}>{task.item_size.replace(/_/g, ' ')}</Text>}
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

          {/* Customer contact */}
          <View style={s.contactCard}>
            <View style={s.contactRow}>
              <View style={s.contactAvatar}>
                <MaterialIcons name="person" size={20} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.contactName}>{task.user_name || 'Customer'}</Text>
                <Text style={s.contactPhone}>{task.user_phone || ''}</Text>
              </View>
              {task.user_phone && (
                <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${task.user_phone}`)}>
                  <MaterialIcons name="phone" size={18} color="#fff" />
                </TouchableOpacity>
              )}
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
                <Text style={s.locationCoord}>{task.pickup_address || `${task.pickup_lat}, ${task.pickup_lng}`}</Text>
              </View>
            </View>
            <View style={s.locationDivider} />
            <View style={s.locationRow}>
              <View style={[s.locationIcon, { backgroundColor: C.secondaryC }]}>
                <MaterialIcons name="place" size={18} color={C.tertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.locationLabel}>{task.type === 'ERRAND' ? 'Errand' : 'Dropoff'}</Text>
                <Text style={s.locationCoord}>{task.dropoff_address || `${task.dropoff_lat}, ${task.dropoff_lng}`}</Text>
              </View>
            </View>
            {task.estimated_distance_km ? (
              <View style={s.distanceChip}>
                <MaterialIcons name="straighten" size={16} color={C.textM} />
                <Text style={s.distanceText}>{task.estimated_distance_km} km</Text>
              </View>
            ) : null}
            {task.item_size ? (
              <View style={s.sizeChip}>
                <Text style={s.sizeText}>{task.item_size.replace(/_/g, ' ')}</Text>
              </View>
            ) : null}
          </View>

          {/* Pricing breakdown — shown after final price is calculated */}
          {task.final_price && (
            <View style={s.pricingCard}>
              <View style={s.pricingHeader}>
                <MaterialIcons name="receipt" size={16} color={C.primary} />
                <Text style={s.pricingTitle}>Price Breakdown</Text>
              </View>
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>Delivery fee</Text>
                <Text style={s.pricingValue}>{parseFloat(task.final_price) - parseFloat(task.item_cost || 0)} ETB</Text>
              </View>
              {task.item_cost && (
                <View style={s.pricingRow}>
                  <Text style={s.pricingLabel}>Item cost</Text>
                  <Text style={s.pricingValue}>{task.item_cost} ETB</Text>
                </View>
              )}
              {parseFloat(task.waiting_time_fee || 0) > 0 && (
                <View style={s.pricingRow}>
                  <Text style={s.pricingLabel}>Waiting fee</Text>
                  <Text style={s.pricingValue}>{task.waiting_time_fee} ETB</Text>
                </View>
              )}
              <View style={s.pricingDivider} />
              <View style={s.pricingTotal}>
                <Text style={s.pricingTotalLabel}>Total</Text>
                <Text style={s.pricingTotalValue}>{task.final_price} ETB</Text>
              </View>
            </View>
          )}

          {/* Note */}
          {task.note ? (
            <View style={s.noteCard}>
              <View style={s.noteHeader}>
                <MaterialIcons name="info-outline" size={16} color={C.tertiary} />
                <Text style={s.noteTitle}>Note from Customer</Text>
              </View>
              <Text style={s.noteText}>{task.note.split(' | ').filter(s => !s.includes(':')).join(' | ') || task.note}</Text>
            </View>
          ) : null}

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

      {/* Amount modal */}
      <Modal visible={showAmount} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Item Amount</Text>
            <Text style={s.modalSub}>Enter the total item cost in ETB:</Text>
            <TextInput
              style={s.modalInput}
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => setShowAmount(false)}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSubmit} onPress={submitAmount}>
                <Text style={s.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Receipt upload modal */}
      <Modal visible={showReceipt} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.receiptModalCard}>
            <Text style={s.modalTitle}>Upload Receipt</Text>
            <Text style={s.modalSub}>Attach a photo of the purchase receipt or SMS confirmation:</Text>

            {receiptImage ? (
              <Image source={{ uri: receiptImage.uri }} style={s.receiptPreview} resizeMode="contain" />
            ) : (
              <TouchableOpacity style={s.receiptPicker} onPress={pickReceipt}>
                <MaterialIcons name="add-a-photo" size={40} color={C.outlineV} />
                <Text style={s.receiptPickerText}>Tap to select photo</Text>
              </TouchableOpacity>
            )}

            <View style={s.receiptTypeRow}>
              <TouchableOpacity
                style={[s.receiptTypeBtn, receiptType === 'receipt' && s.receiptTypeBtnActive]}
                onPress={() => setReceiptType('receipt')}
              >
                <Text style={[s.receiptTypeText, receiptType === 'receipt' && s.receiptTypeTextActive]}>Receipt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.receiptTypeBtn, receiptType === 'sms' && s.receiptTypeBtnActive]}
                onPress={() => setReceiptType('sms')}
              >
                <Text style={[s.receiptTypeText, receiptType === 'sms' && s.receiptTypeTextActive]}>SMS</Text>
              </TouchableOpacity>
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancel} onPress={() => { setShowReceipt(false); setReceiptImage(null); }}>
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.modalSubmit} onPress={uploadReceipt} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.modalSubmitText}>Upload</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  mapBox:   { height: 200, overflow: 'hidden', position: 'relative' },
  mapBoxExpanded: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, height: '100%', zIndex: 100 },
  map:      { flex: 1 },
  driverMarkerView: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  gpsBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.outlineV },
  gpsDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.primaryC },
  gpsText:  { fontSize: 12, color: C.onSurface, fontWeight: '500' },
  mapToggleBtn: { position: 'absolute', bottom: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

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
  sizeBadge:       { fontSize: 11, color: C.primary, backgroundColor: C.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4, overflow: 'hidden' },

  // Customer contact
  contactCard:  { backgroundColor: C.surface, borderRadius: 16, padding: 14, elevation: 1, flexDirection: 'row', alignItems: 'center' },
  contactRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  contactAvatar:{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.secondaryC, alignItems: 'center', justifyContent: 'center' },
  contactName:  { fontSize: 15, fontWeight: '700', color: C.onSurface },
  contactPhone: { fontSize: 13, color: C.onSurfaceV, marginTop: 2 },
  callBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },

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
  sizeChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4, paddingLeft: 4 },
  sizeText:        { fontSize: 12, color: C.primary, fontWeight: '600' },

  // Pricing
  pricingCard:       { backgroundColor: C.surface, borderRadius: 16, padding: 16, elevation: 1 },
  pricingHeader:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pricingTitle:      { fontSize: 14, fontWeight: '700', color: C.onSurface },
  pricingRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  pricingLabel:      { fontSize: 13, color: C.onSurfaceV },
  pricingValue:      { fontSize: 13, fontWeight: '600', color: C.onSurface },
  pricingDivider:    { height: 1, backgroundColor: C.outlineV + '40', marginVertical: 8 },
  pricingTotal:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pricingTotalLabel: { fontSize: 15, fontWeight: '700', color: C.onSurface },
  pricingTotalValue: { fontSize: 17, fontWeight: '900', color: C.primary },

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

  // Amount modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard:     { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, gap: 16 },
  modalTitle:    { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  modalSub:      { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  modalInput:    { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 24, fontWeight: '700', color: '#111827', textAlign: 'center', backgroundColor: '#FAFAFA' },
  modalActions:  { flexDirection: 'row', gap: 12 },
  modalCancel:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalSubmit:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#16A34A' },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Receipt modal
  receiptModalCard:   { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360, gap: 14 },
  receiptPreview:     { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#E5E7EB' },
  receiptPicker:      { width: '100%', height: 160, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FAFAFA' },
  receiptPickerText:  { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  receiptTypeRow:     { flexDirection: 'row', gap: 10 },
  receiptTypeBtn:     { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  receiptTypeBtnActive: { borderColor: '#16A34A', backgroundColor: '#dcfce7' },
  receiptTypeText:       { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  receiptTypeTextActive: { color: '#16A34A' },
});
