# Project Context

## What This App Does
A delivery task platform (customer app + driver app + Django backend) for buying, pickup/drop, and errand services in Addis Ababa.

- **Customer App:** `apps/customer-app/` (Expo managed workflow)
- **Worker App:** `apps/worker-app/` (Expo managed workflow)
- **Backend:** `apps/backend/` (Django REST Framework)
- **Backend URL:** `http://192.168.1.8:8000/api/v1`

## Key Decisions
- Free OSM services only — Photon (autocomplete), Nominatim (reverse geocode), CartoDB Positron tiles, MapLibre via `react-native-maps` `UrlTile`
- No API keys, no accounts, no credit card for map/geocode
- Expo managed workflow — no dev builds, `react-native-maps` + `expo-location`
- Coordinates rounded to 6 decimal places before backend submit

## Pricing
- **DELIVERY / SHOPPING:** 30 ETB base first km, +10 ETB per additional km, + size premium (up_to_2kg=+10, up_to_6kg=+20, up_to_10kg=+30)
- **ERRAND (no pickup, same location):** flat 30 ETB (no size premium)
- **ERRAND (with pickup, round trip):** `30 + round(dist × 20)` (no size premium). The ×20 = 10 ETB/km × 2 (return trip)
- Errands skip purchase/approval flow (like delivery), only SHOPPING requires approval

## Task Lifecycle FSM — Stepper Per Type

**Stepper (Customer view, includes PENDING):**
- **DELIVERY:** PENDING → ASSIGNED → ARRIVED → DELIVERING → COMPLETED
- **SHOPPING:** PENDING → ASSIGNED → ARRIVED → AWAITING_APPROVAL → PURCHASED → DELIVERING → COMPLETED
- **ERRAND:** PENDING → ASSIGNED → ARRIVED → COMPLETED

**Stepper (Driver view, no PENDING):**
- **DELIVERY:** ASSIGNED → ARRIVED → DELIVERING → COMPLETED
- **SHOPPING:** ASSIGNED → ARRIVED → AWAITING_APPROVAL → PURCHASED → DELIVERING → COMPLETED
- **ERRAND:** ASSIGNED → ARRIVED → COMPLETED

**Action buttons:**
- ARRIVED → DELIVERY: "Start Delivery", SHOPPING: "Request Approval", ERRAND: "Complete Errand"
- ERRAND's "Complete Errand" calls `start_delivery` which auto-completes (ARRIVED → DELIVERING → COMPLETED in one step) + runs financial settlement

## Fields on Task Model
- `item_size`: `up_to_2kg` / `up_to_6kg` / `up_to_10kg` (blank/null, DELIVERY only)
- `pickup_address` / `dropoff_address`: string fallback for coordinates

## Serializer Fields (TaskDetailSerializer)
- `driver_latitude` / `driver_longitude`: live driver GPS
- `driver_name` / `driver_phone`: from DriverProfile.full_name and user.phone_number
- `user_name` / `user_phone`: from UserProfile.name fallback to username, and phone_number

## Customer Cancel Rules
- Can cancel only when **PENDING** or **ASSIGNED**
- Cannot cancel when ARRIVED, DELIVERING, PURCHASED, COMPLETED

## Map Marker Labels
- Dropoff marker title shows "Errand" instead of "Dropoff" for ERRAND type (both customer tracking and driver active screens)
- Location card label also shows "Errand" instead of "Dropoff" for ERRAND

## Customer Contact on Driver App
- DriverActiveTaskScreen shows a customer contact card with name + phone + call button
- Uses `task.user_name` / `task.user_phone` from TaskDetailSerializer

## Current State — Everything Implemented

### Map & Location (Customer App)
- `LocationPicker.js` — reusable map/pin/autocomplete/GPS component
- `RequestFormScreen.js` — step-based task creation with LocationPicker per type
- Coordinates + address strings sent on task creation

### Task Lifecycle FSM

**DELIVERY:** ASSIGNED → ARRIVED → DELIVERING → COMPLETED
**SHOPPING:** ASSIGNED → ARRIVED → AWAITING_APPROVAL → PURCHASED → DELIVERING → COMPLETED
**ERRAND:** ASSIGNED → ARRIVED → COMPLETED (auto-skip DELIVERING)

- DriverActiveTaskScreen dynamically shows right action per type
- Backend validates FSM transitions per type
- `start_delivery`: DELIVERY from ARRIVED, ERRAND from ARRIVED (auto-completes)
- `complete_task`: all types from DELIVERING
- Receipt upload for SHOPPING: PURCHASED shows "Upload Receipt" button → modal (image picker + Receipt/SMS type toggle) → `verify_receipt()` on backend transitions PURCHASED → DELIVERING

### Pricing
- DELIVERY/SHOPPING: haversine distance pricing + size premium
- ERRAND (no pickup): flat 30
- ERRAND (with pickup): 30 + round(dist × 20)
- Stored as `estimated_price`, also sets `estimated_distance_km`

### Address Display
- `pickup_address` / `dropoff_address` fields on Task model
- Customer TaskDetailScreen shows address text (fallback to lat/lng)
- Driver HomeScreen available tasks show address text
- DriverActiveTaskScreen shows address text

### Note (Description) Display
- `buildNote()` only includes: category, description, task type, item type, size
- All 3 screens (TaskDetail, DriverHome, DriverActiveTask) strip labeled metadata from note
- Only the free-text description shows (e.g. "buy me burger")

### Driver Online Re-Dispatch
- When driver toggles online, `_redispatch_nearby_tasks()` finds + dispatches nearby pending tasks

### Driver Rating (Customer → Driver, 1-5 stars)
- `Rating` model (`from_user`, `to_user`, `task`, `rating`, `comment`) — exists in `0001_initial`
- `POST /api/v1/tasks/{id}/rate/` — customer rates driver after COMPLETED, auto-recalculates `User.rating` / `User.rating_count`
- `GET /api/v1/tasks/{id}/rate/` — check if already rated
- `GET /api/v1/driver/ratings/` — driver's average + count + recent reviews
- `TaskDetailSerializer` includes `driver_rating` / `driver_rating_count` fields
- `Rating` registered in admin (`/admin/customers/rating/`)
- Customer TaskTrackingScreen: "Rate this Driver" button appears after COMPLETED → star modal (1-5 + optional comment + Skip)
- Customer TaskDetailScreen: "Rate Driver" button shown for COMPLETED tasks
- Worker DriverProfileScreen: shows average rating + review count in stats row
- TaskTrackingScreen stops polling when task reaches COMPLETED

### DriverProfile
- `is_blocked` no longer auto-set on debt limit (admin-controlled only)
- `is_return_trip` removed
- `is_blocked` editable in admin panel

## Polling
- Driver app polls for assignments every 15s
- Customer TaskTrackingScreen polls every 10s

## Live Maps on Tracking Screens
- **Customer TaskTrackingScreen** — MapView with CartoDB tiles, pickup (green), dropoff/errand (red), driver (blue with truck icon) markers, Polylines pickup↔dropoff + driver↔pickup, auto-fits to show all markers on load
- **Worker DriverActiveTaskScreen** — Same map layout with driver's own GPS position shown as blue marker, GPS Active badge overlay, auto-fits to all markers after GPS resolves
- Driver location on customer side served via `driver_latitude`/`driver_longitude` fields on `TaskDetailSerializer`
- `watchPositionAsync` (Accuracy.Balanced, 5s interval, 10m distance) for reliable GPS marker on driver map

## Known TODOs / Improvements Not Done
1. Push notifications on status changes (all marked `# TODO` in progression code)
2. Earnings on DriverHomeScreen (shows 0 ETB always)
3. Driver rates customer (only customer→driver implemented)

## How to Run
```bash
# Backend
cd apps/backend
python manage.py runserver 0.0.0.0:8000

# Customer App
cd apps/customer-app
npx expo start

# Worker App
cd apps/worker-app
npx expo start
```
