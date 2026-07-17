import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal, SafeAreaView,
} from 'react-native';
import MapView, { UrlTile, Marker } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

const LocationPicker = ({
  label,
  initialLat = 9.0192,
  initialLng = 38.7578,
  address: initialAddress = '',
  onLocationChange,
  mapHeight = 200,
  expandable = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [searchText, setSearchText] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState({
    latitude: initialLat,
    longitude: initialLng,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [markerCoord, setMarkerCoord] = useState({
    latitude: initialLat,
    longitude: initialLng,
  });
  const debounceRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const searchPhoton = async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${PHOTON_URL}?q=${encodeURIComponent(query.trim())}&limit=5&lang=en`,
        { headers: { 'User-Agent': 'LuckyApp/1.0' } },
      );
      if (!res.ok) return;
      const data = await res.json();
      const features = data.features || [];
      setSuggestions(
        features.map((f, idx) => {
          const p = f.properties || {};
          const coords = f.geometry?.coordinates || [];
          const parts = [p.name, p.street, p.city, p.county, p.country].filter(Boolean);
          return {
            _k: p.osm_id ?? p.osm_key ?? `sug-${idx}`,
            displayName: parts.join(', '),
            lat: coords[1],
            lng: coords[0],
          };
        }),
      );
      setShowSuggestions(true);
    } catch (err) {
      console.warn('Photon search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPhoton(text), 350);
  };

  const selectSuggestion = (item) => {
    const coord = { latitude: item.lat, longitude: item.lng };
    setMarkerCoord(coord);
    setRegion((prev) => ({ ...prev, ...coord }));
    setSearchText(item.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    onLocationChange?.(item.lat, item.lng, item.displayName);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await fetch(
        `${NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'LuckyApp/1.0' } },
      );
      if (!res.ok) throw new Error('Nominatim error');
      const data = await res.json();
      const addr = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSearchText(addr);
      onLocationChange?.(lat, lng, addr);
    } catch {
      const fallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setSearchText(fallback);
      onLocationChange?.(lat, lng, fallback);
    }
  };

  const handleMarkerDragEnd = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    setRegion((prev) => ({ ...prev, latitude, longitude }));
    reverseGeocode(latitude, longitude);
  };

  const handleMapPress = (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });
    reverseGeocode(latitude, longitude);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      setMarkerCoord({ latitude, longitude });
      const newRegion = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(newRegion);
      mapRef.current?.animateToRegion(newRegion, 500);
      reverseGeocode(latitude, longitude);
    } catch (err) {
      console.warn('GPS error:', err);
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.searchRow}>
        <View style={styles.inputWrapper}>
          <MaterialIcons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.input}
            placeholder="Search location..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={handleSearchChange}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          {loading && <ActivityIndicator size="small" color="#16A34A" />}
        </View>
        <TouchableOpacity style={styles.gpsBtn} onPress={handleUseCurrentLocation} activeOpacity={0.7}>
          <MaterialIcons name="my-location" size={20} color="#16A34A" />
        </TouchableOpacity>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <ScrollView style={styles.suggestionsContainer} keyboardShouldPersistTaps="handled">
          {suggestions.map((item) => (
            <TouchableOpacity
              key={item._k}
              style={styles.suggestionItem}
              onPress={() => selectSuggestion(item)}
              activeOpacity={0.6}
            >
              <MaterialIcons name="location-on" size={18} color="#6B7280" style={{ marginRight: 8 }} />
              <Text style={styles.suggestionText} numberOfLines={2}>
                {item.displayName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={[styles.mapContainer, { height: mapHeight }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          mapType="none"
          onPress={handleMapPress}
        >
          <UrlTile
            urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
            maximumZ={19}
            flipY={false}
          />
          <Marker
            coordinate={markerCoord}
            draggable
            onDragEnd={handleMarkerDragEnd}
          />
        </MapView>
        {expandable && (
          <TouchableOpacity style={styles.expandBtn} onPress={() => setExpanded(true)} activeOpacity={0.7}>
            <MaterialIcons name="fullscreen" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.coordsText}>
        {markerCoord.latitude.toFixed(6)}, {markerCoord.longitude.toFixed(6)}
      </Text>

      {expandable && (
        <Modal visible={expanded} animationType="slide" statusBarTranslucent>
          <SafeAreaView style={styles.modalContainer}>
            <MapView
              style={styles.modalMap}
              region={region}
              mapType="none"
              onPress={handleMapPress}
            >
              <UrlTile
                urlTemplate="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                maximumZ={19}
                flipY={false}
              />
              <Marker
                coordinate={markerCoord}
                draggable
                onDragEnd={handleMarkerDragEnd}
              />
            </MapView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setExpanded(false)} activeOpacity={0.7}>
              <MaterialIcons name="fullscreen-exit" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: '#FAFAFA',
    height: 44,
  },
  searchIcon: { marginRight: 6 },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    paddingVertical: 0,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionsContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    maxHeight: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  mapContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  map: { flex: 1 },
  expandBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalMap: {
    flex: 1,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordsText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
  },
});

export default LocationPicker;
