# Implementation Plan: Delivery Platform

## Overview

Incremental implementation across four layers: Django backend (models, API, auth), Customer App (React Native/Expo), Worker App (React Native/Expo), and Admin Dashboard (React web). Each phase builds on the previous and ends with integration wiring.

## Tasks

- [ ] 1. Django project setup and database models
  - Initialize Django project with Django REST Framework and Supabase PostgreSQL connection
  - Create Django apps: `core`, `requests`, `workers`, `customers`, `locations`, `notifications`
  - Write database migrations for all tables: `profiles`, `workers`, `customers`, `requests`, `worker_locations`, `admin_notifications`
  - Implement Supabase JWT verification middleware that extracts user identity from `Authorization: Bearer` header
  - Implement role-based permission classes: `IsCustomer`, `IsWorker`, `IsAdmin`
  - _Requirements: 1.3, 2.3, 14.1, 16.1_

- [ ] 2. Customer and Worker profile APIs
  - [ ] 2.1 Implement `GET /api/customers/me/` and `PATCH /api/customers/me/` endpoints
    - Return and update customer name; phone is read-only from auth
    - Auto-create `customers` row on first login if not exists
    - _Requirements: 9.1, 9.2_
  - [ ] 2.2 Implement `POST /api/auth/register-push-token/` endpoint
    - Accept `expo_push_token` and store on the authenticated user's `customers` or `workers` row
    - _Requirements: 8.1, 10.4_
  - [ ]* 2.3 Write unit tests for profile and push token endpoints
    - Test name update, push token registration, and unauthenticated access rejection
    - _Requirements: 9.2, 8.1_

- [ ] 3. Request creation API
  - [ ] 3.1 Implement `POST /api/requests/` endpoint
    - Validate `service_type` and required `form_data` fields per service type (buy_something, pick_and_drop, run_errand)
    - Generate `readable_id` using `REQ-{YYYYMMDD}-{sequence}` pattern
    - Set initial status to `pending`
    - On creation, insert a row into `admin_notifications`
    - _Requirements: 4.3, 5.2, 6.2, 4.4, 5.3, 6.3_
  - [ ] 3.2 Implement image upload support for Buy Something requests
    - Accept up to 5 image files, upload to Supabase Storage, store URLs in `image_urls` array
    - _Requirements: 4.2_
  - [ ]* 3.3 Write unit tests for request creation
    - Test all three service types, readable_id uniqueness, image limit enforcement, and missing field validation
    - _Requirements: 4.1, 5.1, 6.1, 4.3, 5.2, 6.2_

- [ ] 4. Request listing and detail APIs
  - [ ] 4.1 Implement `GET /api/requests/` with role-based filtering
    - Admin: return all requests; Customer: return only own requests
    - Support `?status=` query param filter
    - _Requirements: 7.1, 14.1_
  - [ ] 4.2 Implement `GET /api/requests/{id}/` endpoint
    - Return full request detail including all form_data fields
    - _Requirements: 7.3, 14.2_
  - [ ]* 4.3 Write unit tests for request listing and detail
    - Test customer isolation, admin full access, and status filtering
    - _Requirements: 7.1, 14.1_

- [ ] 5. Admin assignment and task status transition APIs
  - [ ] 5.1 Implement `PATCH /api/requests/{id}/assign/` endpoint
    - Admin-only; set `worker_id` and transition status `pending → assigned`
    - Reject if request is not in `pending` status
    - Trigger push notifications to assigned Worker and Customer
    - _Requirements: 15.3, 15.4, 15.5_
  - [ ] 5.2 Implement `GET /api/tasks/`, `PATCH /api/tasks/{id}/start/`, `PATCH /api/tasks/{id}/complete/` endpoints
    - Worker: list own assigned tasks; Admin: list all tasks
    - `start/` transitions `assigned → in_progress`; `complete/` transitions `in_progress → completed`
    - Enforce status order; reject out-of-order transitions with 400 error
    - On status change, trigger push notifications to Customer
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 8.1, 8.2, 8.3_
  - [ ]* 5.3 Write unit tests for assignment and status transitions
    - Test valid transitions, out-of-order rejection, and worker isolation
    - _Requirements: 11.4, 15.3_

- [ ] 6. Worker management and availability APIs
  - [ ] 6.1 Implement `GET /api/workers/`, `POST /api/workers/`, `PATCH /api/workers/{id}/`, `PATCH /api/workers/{id}/toggle-status/`
    - Admin-only CRUD; `toggle-status` flips `is_enabled`; disabled workers are blocked at JWT verification layer
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 2.4_
  - [ ] 6.2 Implement `PATCH /api/workers/{id}/availability/` endpoint
    - Worker-only; toggle `availability` between `online` and `offline`
    - _Requirements: 13.2, 13.3, 13.4_
  - [ ]* 6.3 Write unit tests for worker management
    - Test create, edit, enable/disable, and availability toggle
    - _Requirements: 16.1, 16.2, 16.3, 13.2_

- [ ] 7. Location tracking API
  - [ ] 7.1 Implement `POST /api/location/` endpoint
    - Worker-only; accept `latitude`, `longitude`, `request_id`
    - Upsert into `worker_locations` (one current row per worker+request) to avoid unbounded growth
    - Reject if the referenced request is not `in_progress` for that worker
    - _Requirements: 12.1, 12.3_
  - [ ]* 7.2 Write unit tests for location endpoint
    - Test upsert behavior, rejection when task not in_progress, and coordinate storage
    - _Requirements: 12.1, 12.3_

- [ ] 8. Notification preferences API
  - Implement `GET /api/notifications/preferences/` and `PATCH /api/notifications/preferences/`
  - Return and update `notif_assigned`, `notif_progress`, `notif_completed` flags on the `customers` row
  - _Requirements: 8.5_

- [ ] 9. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Customer App — Project setup and authentication
  - Initialize Expo project for Customer App with React Navigation (bottom tabs + stack)
  - Install and configure Supabase JS client (`@supabase/supabase-js`)
  - Implement Phone Entry screen: phone number input, call `supabase.auth.signInWithOtp`
  - Implement OTP Verification screen: 6-digit input, call `supabase.auth.verifyOtp`; show retry on wrong OTP, resend on expiry
  - Implement session listener: redirect to Phone Entry screen when session expires
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [ ] 11. Customer App — Home screen and location
  - Implement Home screen with three service cards (Buy Something, Pick and Drop, Run Errand) and notification icon
  - Request `expo-location` foreground permission on app open; reverse-geocode coordinates to display current address
  - Show manual address entry input if permission is denied
  - Wire bottom tab navigation: Home, Tasks, Profile
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 12. Customer App — Request creation forms
  - [ ] 12.1 Implement multi-step form for Buy Something (≤4 steps)
    - Fields: item name, item description, estimated price, store name/location, delivery address
    - Image picker: up to 5 images via `expo-image-picker`, upload to Supabase Storage, submit URLs with request
    - On submit call `POST /api/requests/`
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 12.2 Implement multi-step form for Pick and Drop (≤4 steps)
    - Fields: pickup address, delivery address, package description, package size (small/medium/large), recipient name, recipient phone
    - On submit call `POST /api/requests/`
    - _Requirements: 5.1, 5.2_
  - [ ] 12.3 Implement multi-step form for Run Errand (≤4 steps)
    - Fields: errand description, locations (multi-entry), estimated budget, special instructions
    - On submit call `POST /api/requests/`
    - _Requirements: 6.1, 6.2_

- [ ] 13. Customer App — Tasks tab and real-time updates
  - Implement Tasks tab showing active tasks and past tasks lists
  - Display each task with status badge (Pending, Assigned, In Progress, Completed)
  - Implement Task Detail screen showing service type, status, Request ID, addresses, and creation timestamp
  - Subscribe to Supabase Realtime `requests` table UPDATE events filtered to own rows; update task status in UI without refresh
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 14. Customer App — Push notifications and preferences
  - Register for Expo push notifications on login; call `POST /api/auth/register-push-token/`
  - Implement in-app notification banner fallback for task status changes when OS notifications are disabled
  - Implement Notification Preferences screen (accessible from Profile tab): toggles for Assigned, In Progress, Completed events; call `PATCH /api/notifications/preferences/`
  - _Requirements: 8.4, 8.5_

- [ ] 15. Customer App — Profile tab
  - Implement Profile screen showing name and phone number
  - Allow name edit via `PATCH /api/customers/me/`
  - _Requirements: 9.1, 9.2_

- [ ] 16. Checkpoint — Customer App complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Worker App — Project setup and authentication
  - Initialize Expo project for Worker App with React Navigation
  - Configure Supabase JS client
  - Implement Login screen: phone number input → OTP verification (same Supabase Auth flow as Customer App)
  - Show account-disabled message when login is rejected due to `is_enabled = false`
  - Implement session expiry redirect to Login screen
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 18. Worker App — Task dashboard and detail
  - Implement Task Dashboard screen: list of tasks assigned to the authenticated worker from `GET /api/tasks/`
  - Display each task with status, service type, and key location details
  - Implement Task Detail screen: show all Customer-submitted form fields, Request ID, current status
  - Subscribe to Supabase Realtime `requests` INSERT/UPDATE events filtered to own worker_id for live task updates
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 19. Worker App — Task execution and location tracking
  - [ ] 19.1 Implement Start and Complete action buttons on Task Detail screen
    - "Start Task" calls `PATCH /api/tasks/{id}/start/`; "Complete Task" calls `PATCH /api/tasks/{id}/complete/`
    - Show buttons conditionally based on current status
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 19.2 Implement background location tracking while task is In Progress
    - Use `expo-location` `watchPositionAsync` at ≤10 second intervals
    - POST coordinates to `POST /api/location/` with `request_id`
    - Display current address via reverse geocoding on Task Detail screen
    - Show "location unavailable" indicator and keep retrying if GPS fix fails
    - Stop tracking when task transitions to Completed
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 20. Worker App — Push notifications and profile
  - Register for Expo push notifications on login; call `POST /api/auth/register-push-token/`
  - Implement Profile screen: display name, Worker ID, and availability toggle (Online/Offline)
  - Availability toggle calls `PATCH /api/workers/{id}/availability/`
  - _Requirements: 10.4, 13.1, 13.2, 13.3, 13.4_

- [ ] 21. Checkpoint — Worker App complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Admin Dashboard — Project setup and authentication
  - Initialize React web app (Vite + React)
  - Configure Supabase JS client for admin auth (phone/OTP)
  - Implement Login page with phone + OTP flow
  - Implement route guard: redirect unauthenticated users to Login
  - _Requirements: 14.1_

- [ ] 23. Admin Dashboard — Requests list and detail
  - [ ] 23.1 Implement Requests List page
    - Fetch from `GET /api/requests/` with status filter tabs (Pending, Assigned, In Progress, Completed)
    - Subscribe to Supabase Realtime `requests` INSERT/UPDATE to update list in real time
    - _Requirements: 14.1, 14.3_
  - [ ] 23.2 Implement Request Detail view
    - Display Request ID, service type, all form_data fields, creation timestamp, and current status
    - _Requirements: 14.2_

- [ ] 24. Admin Dashboard — Worker assignment
  - Implement "Assign Worker" action on Pending request detail view
  - Show Worker Assignment Modal: list workers from `GET /api/workers/` with name, Worker ID, and availability status
  - On confirm, call `PATCH /api/requests/{id}/assign/`; update request status in UI
  - _Requirements: 15.1, 15.2, 15.3_

- [ ] 25. Admin Dashboard — Worker management
  - Implement Worker Management page: list all workers with name, Worker ID, availability, and enabled status
  - Implement Create Worker form: full name, phone number, Worker ID; call `POST /api/workers/`
  - Implement Edit Worker form: name and phone; call `PATCH /api/workers/{id}/`
  - Implement Enable/Disable toggle: call `PATCH /api/workers/{id}/toggle-status/`
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 26. Admin Dashboard — Operations overview and live map
  - [ ] 26.1 Implement Operations Overview page
    - Display daily summary counts: Pending, Assigned, In Progress, Completed
    - Display completed tasks list filterable by date range
    - _Requirements: 18.1, 18.2_
  - [ ] 26.2 Implement Live Map view
    - Display location markers for all workers with `in_progress` tasks using latest `worker_locations` rows
    - Subscribe to Supabase Realtime `worker_locations` INSERT to update markers in real time
    - Remove marker when worker's task is completed
    - _Requirements: 17.1, 17.2, 17.3_

- [ ] 27. Final checkpoint — Full system integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each layer boundary
- No property-based tests are included as the design has no Correctness Properties section; unit tests cover edge cases
