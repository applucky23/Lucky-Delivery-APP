# Requirements Document

## Introduction

An on-demand delivery platform consisting of two mobile applications (Customer and Worker) built with React Native (Expo), a web-based Admin Dashboard, and a Django backend with Supabase for database and authentication. The platform connects customers with workers to fulfill three core service types: Buy Something (purchase and deliver an item), Pick and Drop (collect and deliver a package), and Run Errand (perform tasks on behalf of the customer). The system supports the full lifecycle of a delivery request: creation, manual assignment by an admin, real-time tracking, and completion. All requests are on-demand (no scheduling). Payment integration (Telebirr) is deferred to a future phase.

## Glossary

- **Customer**: A registered user who creates delivery requests via the Customer mobile app.
- **Worker**: A platform-managed user who receives and fulfills assigned tasks via the Worker mobile app.
- **Admin**: A platform operator who manages requests, assigns workers, and monitors operations via the Admin Web Dashboard.
- **Request**: A delivery job created by a Customer, belonging to one of the three service types.
- **Task**: A Request that has been assigned to a Worker by an Admin.
- **Service_Type**: One of three categories — Buy_Something, Pick_and_Drop, or Run_Errand.
- **Customer_App**: The React Native (Expo) mobile application used by Customers.
- **Worker_App**: The React Native (Expo) mobile application used by Workers.
- **Admin_Dashboard**: The web-based dashboard used by Admins to manage the platform.
- **API**: The Django REST backend that processes business logic.
- **Auth_Service**: The Supabase authentication service.
- **Database**: The Supabase PostgreSQL database.
- **Tracker**: The real-time location and status tracking subsystem.
- **Notification_Service**: The push notification delivery subsystem.
- **OTP**: One-time password sent via SMS for phone number verification.

---

## Requirements

### Requirement 1: Customer Authentication

**User Story:** As a Customer, I want to register and log in using my phone number and OTP, so that I can access the platform securely without needing a password.

#### Acceptance Criteria

1. THE Customer_App SHALL present a phone number entry screen as the entry point for registration and login.
2. WHEN a Customer submits a phone number, THE Auth_Service SHALL send an OTP to that phone number via SMS.
3. WHEN a Customer submits a valid OTP, THE Auth_Service SHALL issue a session token and grant access to the Customer_App.
4. IF a Customer submits an incorrect OTP, THEN THE Auth_Service SHALL return a verification error and allow the Customer to retry.
5. IF a Customer submits an OTP that has expired, THEN THE Auth_Service SHALL return an expiry error and allow the Customer to request a new OTP.
6. WHEN a session token expires, THE Customer_App SHALL redirect the Customer to the phone number entry screen.

---

### Requirement 2: Worker Authentication

**User Story:** As a Worker, I want to log in using credentials provided by the Admin, so that I can access my assigned tasks.

#### Acceptance Criteria

1. THE Worker_App SHALL present a login screen accepting a phone number and OTP.
2. WHEN a Worker submits a phone number, THE Auth_Service SHALL send an OTP to that phone number via SMS.
3. WHEN a Worker submits a valid OTP, THE Auth_Service SHALL issue a session token and grant access to the Worker_App.
4. IF a Worker account has been disabled by an Admin, THEN THE Auth_Service SHALL reject the login attempt and display an account-disabled message.
5. WHEN a session token expires, THE Worker_App SHALL redirect the Worker to the login screen.

---

### Requirement 3: Customer Home Screen and Navigation

**User Story:** As a Customer, I want a clear home screen with my location and available services, so that I can quickly create a new request.

#### Acceptance Criteria

1. WHEN a Customer opens the Customer_App, THE Customer_App SHALL display a home screen showing: the Customer's auto-detected current location, a notification icon, and three service cards (Buy Something, Pick and Drop, Run Errand).
2. THE Customer_App SHALL provide bottom navigation with three tabs: Home, Tasks, and Profile.
3. WHEN the Customer_App is opened, THE Customer_App SHALL request device location permission and, upon grant, populate the home screen with the Customer's current address via reverse geocoding.
4. IF location permission is denied, THEN THE Customer_App SHALL allow the Customer to enter a location manually.

---

### Requirement 4: Customer Request Creation — Buy Something

**User Story:** As a Customer, I want to request someone to buy a specific item and deliver it to me, so that I can receive goods without going to the store myself.

#### Acceptance Criteria

1. WHEN a Customer selects the Buy_Something service type, THE Customer_App SHALL present a multi-step form (maximum 4 steps) requesting: item name, item description, estimated item price, store name or location, and delivery destination address.
2. THE Customer_App SHALL allow the Customer to attach up to 5 reference images for the item.
3. WHEN the Customer submits a Buy_Something request, THE API SHALL create a Request record with status "Pending" and a unique readable Request ID.
4. WHEN a Request is created, THE Notification_Service SHALL notify the Admin of the new incoming request.

---

### Requirement 5: Customer Request Creation — Pick and Drop

**User Story:** As a Customer, I want to request pickup and delivery of a package, so that I can send items to another location without traveling myself.

#### Acceptance Criteria

1. WHEN a Customer selects the Pick_and_Drop service type, THE Customer_App SHALL present a multi-step form (maximum 4 steps) requesting: pickup address, delivery address, package description, package size (small, medium, or large), recipient name, and recipient phone number.
2. WHEN the Customer submits a Pick_and_Drop request, THE API SHALL create a Request record with status "Pending" and a unique readable Request ID.
3. WHEN a Request is created, THE Notification_Service SHALL notify the Admin of the new incoming request.

---

### Requirement 6: Customer Request Creation — Run Errand

**User Story:** As a Customer, I want to request a Worker to run errands on my behalf, so that I can complete tasks without being physically present.

#### Acceptance Criteria

1. WHEN a Customer selects the Run_Errand service type, THE Customer_App SHALL present a multi-step form (maximum 4 steps) requesting: errand description, location(s) to visit, estimated budget, and special instructions.
2. WHEN the Customer submits a Run_Errand request, THE API SHALL create a Request record with status "Pending" and a unique readable Request ID.
3. WHEN a Request is created, THE Notification_Service SHALL notify the Admin of the new incoming request.

---

### Requirement 7: Customer Task Management

**User Story:** As a Customer, I want to view my active and past tasks, so that I can track the progress of my requests.

#### Acceptance Criteria

1. WHEN a Customer navigates to the Tasks tab, THE Customer_App SHALL display a list of active tasks and a list of past tasks for the authenticated Customer.
2. THE Customer_App SHALL display each task with its current status: Pending, Assigned, In Progress, or Completed.
3. WHEN a Customer views a task detail, THE Customer_App SHALL display: service type, status, Request ID, relevant addresses, and creation timestamp.
4. WHEN a task status changes, THE Customer_App SHALL update the displayed status in real time without requiring a manual refresh.

---

### Requirement 8: Customer Push Notifications

**User Story:** As a Customer, I want to receive push notifications for key task events, so that I stay informed without keeping the app open.

#### Acceptance Criteria

1. THE Notification_Service SHALL send a push notification to the Customer when a task status changes to "Assigned".
2. THE Notification_Service SHALL send a push notification to the Customer when a task status changes to "In Progress".
3. THE Notification_Service SHALL send a push notification to the Customer when a task status changes to "Completed".
4. WHEN a Customer has disabled push notifications at the OS level, THE Customer_App SHALL display an in-app notification banner as a fallback for task status change events.
5. THE Customer_App SHALL provide a notification preferences screen where the Customer can enable or disable notifications by event category.

---

### Requirement 9: Customer Profile

**User Story:** As a Customer, I want to manage my profile, so that my account information is accurate.

#### Acceptance Criteria

1. WHEN a Customer navigates to the Profile tab, THE Customer_App SHALL display the Customer's name and phone number.
2. THE Customer_App SHALL allow the Customer to update their name.

---

### Requirement 10: Worker Task Dashboard

**User Story:** As a Worker, I want to view my assigned tasks, so that I know what I need to fulfill.

#### Acceptance Criteria

1. WHEN a Worker logs in, THE Worker_App SHALL display a task dashboard showing all tasks currently assigned to that Worker.
2. THE Worker_App SHALL display each task with its status, service type, and key location details.
3. WHEN a Worker selects a task, THE Worker_App SHALL display the full task details including: service type, Request ID, all form fields submitted by the Customer, and current status.
4. WHEN a new task is assigned to a Worker, THE Notification_Service SHALL send a push notification to that Worker.

---

### Requirement 11: Worker Task Execution

**User Story:** As a Worker, I want to update the status of my assigned tasks, so that the Customer and Admin can track progress.

#### Acceptance Criteria

1. WHEN a Worker views an assigned task with status "Assigned", THE Worker_App SHALL present an option to start the task.
2. WHEN a Worker starts a task, THE API SHALL update the task status to "In Progress".
3. WHEN a Worker completes a task, THE API SHALL update the task status to "Completed".
4. THE API SHALL enforce the status transition order: Assigned → In Progress → Completed, rejecting out-of-order transitions.

---

### Requirement 12: Worker Location Tracking

**User Story:** As a Worker, I want my location to be shared while I am on an active task, so that the Admin can monitor operations and the Customer can be informed of progress.

#### Acceptance Criteria

1. WHILE a Worker has a task with status "In Progress", THE Tracker SHALL send the Worker's GPS coordinates to the Database at intervals of no more than 10 seconds.
2. THE Worker_App SHALL display the Worker's current address using reverse geocoding of the Worker's GPS coordinates.
3. WHEN a Worker's task status changes to "Completed", THE Tracker SHALL stop sending location updates for that task.
4. IF the Worker_App cannot obtain a GPS fix, THEN THE Worker_App SHALL display a "location unavailable" indicator and continue retrying.

---

### Requirement 13: Worker Profile and Availability

**User Story:** As a Worker, I want to manage my availability status, so that the Admin knows when I am ready to accept tasks.

#### Acceptance Criteria

1. WHEN a Worker navigates to the Profile screen, THE Worker_App SHALL display the Worker's name, Worker ID, and current availability status.
2. THE Worker_App SHALL allow the Worker to toggle availability between "Online" and "Offline".
3. WHEN a Worker sets availability to "Online", THE API SHALL update the Worker's availability status in the Database.
4. WHEN a Worker sets availability to "Offline", THE API SHALL update the Worker's availability status in the Database.

---

### Requirement 14: Admin — Request Management

**User Story:** As an Admin, I want to view and manage all incoming requests, so that I can oversee platform operations and assign workers promptly.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a list of all Requests, filterable by status: Pending, Assigned, In Progress, and Completed.
2. WHEN an Admin selects a Request, THE Admin_Dashboard SHALL display the full request details including: Request ID, service type, all Customer-submitted form fields, creation timestamp, and current status.
3. THE Admin_Dashboard SHALL update the request list in real time as new requests arrive and statuses change.

---

### Requirement 15: Admin — Worker Assignment

**User Story:** As an Admin, I want to manually assign a Worker to a request, so that the request can be fulfilled.

#### Acceptance Criteria

1. WHEN an Admin views a Request with status "Pending", THE Admin_Dashboard SHALL present an option to assign a Worker.
2. WHEN an Admin initiates assignment, THE Admin_Dashboard SHALL display a list of Workers showing each Worker's name, Worker ID, and current availability status.
3. WHEN an Admin selects a Worker and confirms the assignment, THE API SHALL update the Request status to "Assigned" and associate the selected Worker with the Request.
4. WHEN a Worker is assigned to a Request, THE Notification_Service SHALL send a push notification to the assigned Worker.
5. WHEN a Worker is assigned to a Request, THE Notification_Service SHALL send a push notification to the Customer confirming the assignment.

---

### Requirement 16: Admin — Worker Management

**User Story:** As an Admin, I want to add, edit, and manage Worker accounts, so that I control who can operate on the platform.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL allow an Admin to create a new Worker account by providing: full name, phone number, and Worker ID.
2. THE Admin_Dashboard SHALL allow an Admin to edit an existing Worker's name and phone number.
3. THE Admin_Dashboard SHALL allow an Admin to enable or disable a Worker account.
4. WHEN a Worker account is disabled, THE Auth_Service SHALL prevent that Worker from logging in.
5. WHEN a Worker account is re-enabled, THE Auth_Service SHALL allow that Worker to log in again.

---

### Requirement 17: Admin — Worker Location Monitoring

**User Story:** As an Admin, I want to see the live location of Workers on active tasks, so that I can monitor field operations.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display the current GPS location of each Worker who has a task with status "In Progress".
2. THE Admin_Dashboard SHALL update Worker location markers in real time as location updates are received from the Tracker.
3. WHEN a Worker's task is completed, THE Admin_Dashboard SHALL remove that Worker's live location marker.

---

### Requirement 18: Admin — Operations Overview

**User Story:** As an Admin, I want a system overview of active and completed tasks, so that I can monitor platform performance.

#### Acceptance Criteria

1. THE Admin_Dashboard SHALL display a summary view showing: total Pending requests, total Assigned tasks, total In Progress tasks, and total Completed tasks for the current day.
2. THE Admin_Dashboard SHALL display a list of all completed tasks filterable by date range.

---

## Future Features (Out of Scope for Current Phase)

The following features are documented for future phases and are NOT included in the current requirements:

- **Auto-assignment**: Automatic matching of requests to Workers based on proximity and availability.
- **Ratings and reviews**: Post-delivery rating system for Workers.
- **In-app payments**: Telebirr integration for payment processing, holds, captures, and Worker payouts.
- **Subscription services**: Recurring service plans for Customers.
- **Additional service types**: Home services, cleaning, repairs.
- **Amharic localization**: Multi-language support.
