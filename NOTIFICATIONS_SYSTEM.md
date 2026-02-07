# 5G Emergency Response Network - Notifications System

## Overview

A comprehensive multi-channel notification system for the 5G Emergency Response Network, providing real-time alerts across SMS, WhatsApp, Push Notifications, Email, In-App, and Hospital Intercoms.

## Architecture

```
Event (dispatch, vitals, status)
  ↓
NotificationService (determines channels & urgency)
  ↓
NotificationQueue (Bull + Redis)
  ↓
Channel Adapters:
  - SMS (Twilio)
  - WhatsApp (Twilio)
  - Push (Firebase Cloud Messaging)
  - Email (SendGrid + Nodemailer)
  - In-App (WebSocket)
  - Hospital Intercom (HTTP API)
  ↓
Recipient (paramedic, dispatcher, hospital)
```

## Features

### 1. Multi-Channel Notifications

- **Push Notifications**: Firebase Cloud Messaging + Apple Push Notification service
- **SMS**: Twilio SMS integration with 160-character formatting
- **WhatsApp**: Twilio WhatsApp API with rich formatting
- **Email**: SendGrid for primary, Nodemailer for fallback
- **In-App**: Real-time WebSocket notifications
- **Hospital Intercom**: Speaker announcements for incoming ambulances

### 2. Smart Routing Rules

Priority-based channel selection:

| Priority | Channels | Use Case |
|----------|----------|----------|
| **Critical** | Push + SMS | Life-threatening situations |
| **Urgent** | Push + SMS | Time-sensitive responses |
| **Normal** | Push only | Regular updates |
| **Low** | In-App only | Non-urgent info |

### 3. Quiet Hours

- Configurable DND (Do Not Disturb) periods (default: 23:00-08:00)
- Silent push notifications during quiet hours
- Critical events override quiet hours
- Per-user customization

### 4. Notification Preferences

Users can configure:

```json
{
  "push_enabled": true,
  "sms_enabled": true,
  "whatsapp_enabled": false,
  "email_enabled": true,
  "inapp_enabled": true,
  "dnd_enabled": true,
  "dnd_start_time": "23:00:00",
  "dnd_end_time": "08:00:00",
  "dnd_override_critical": true,
  "language": "en" // or "tr" for Turkish
}
```

### 5. Acknowledgment System

- Require acknowledgment for critical/urgent events
- 60-second timeout with automatic escalation
- SMS quick response format (Y/N)
- WhatsApp quick reply buttons
- Dashboard shows unacknowledged alerts

### 6. Queue Management

- Bull queue for background job processing
- Exponential backoff retry: 1s → 5s → 30s
- Up to 3 retry attempts per notification
- Offline queue processing when user comes online
- Delivery tracking in database

### 7. Analytics & Reporting

Track metrics:
- Delivery rate (target: 99.9%)
- Acknowledgment time (average)
- Channel effectiveness (push vs SMS response rate)
- Delivery failures & reasons
- Peak notification load per hour

## Database Schema

### notification_preferences
Stores user notification settings and preferences.

### notification_templates
Reusable templates for different event types:
- `dispatch_new_call` - New emergency dispatch
- `ambulance_en_route` - Ambulance accepted and moving
- `vital_alert_critical` - Critical vital sign change
- `hospital_arrival` - Ambulance at hospital
- `patient_handoff` - Patient transferred to hospital

### notifications
Main notification records with full status tracking.

### notification_channels
Detailed history of each channel attempt per notification.

### notification_queue
Background job queue integration with Bull/Redis.

### notification_acknowledgments
Records of user responses to critical notifications.

### notification_analytics
Hourly aggregated metrics for reporting.

## Configuration

### Environment Variables

```bash
# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+1234567890

# Firebase Cloud Messaging
FIREBASE_CREDENTIALS_PATH=/path/to/credentials.json
# OR
FIREBASE_CONFIG={"type":"service_account","project_id":"..."}

# SendGrid
SENDGRID_API_KEY=your_api_key
EMAIL_FROM_ADDRESS=noreply@5g-emergency.local

# SMTP Fallback
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASSWORD=password
SMTP_SECURE=false

# Redis/Bull
REDIS_URL=redis://localhost:6379

# Hospital Intercoms
HOSPITAL_SPEAKERS_CONFIG='{"hospital_1": {"speakerIps": ["192.168.1.10"], "authToken": "token"}}'
```

### Initialization

```javascript
const NotificationService = require('./services/notifications/notification-service');
const NotificationQueue = require('./services/notifications/notification-queue');

// Initialize services
const notificationService = new NotificationService(config);
await notificationService.initialize();

const notificationQueue = new NotificationQueue(config);
await notificationQueue.initialize(notificationService);

app.set('notificationService', notificationService);
app.set('notificationQueue', notificationQueue);
```

## API Endpoints

### Get User Preferences
```
GET /api/notifications/preferences
```

Response:
```json
{
  "push_enabled": true,
  "sms_enabled": true,
  "email_enabled": true,
  "inapp_enabled": true,
  "language": "en",
  "dnd_enabled": false
}
```

### Update Preferences
```
PUT /api/notifications/preferences
```

Body:
```json
{
  "dnd_enabled": true,
  "dnd_start_time": "23:00:00",
  "dnd_end_time": "08:00:00",
  "language": "tr"
}
```

### Get Notifications
```
GET /api/notifications?category=dispatch&status=pending&limit=50&offset=0
```

### Get Unacknowledged Critical
```
GET /api/notifications/critical/unacknowledged
```

### Acknowledge Notification
```
POST /api/notifications/{notificationId}/acknowledge
```

Body:
```json
{
  "response": "accepted" // or "rejected"
}
```

### Mark as Read
```
PUT /api/notifications/{notificationId}/read
```

### Get Analytics
```
GET /api/notifications/analytics/summary?days=7
```

## Usage Examples

### Send a Dispatch Alert

```javascript
const notificationService = app.get('notificationService');

const notification = {
  user_id: paramedic_id,
  title: 'New Emergency Call',
  body: 'Patient requires immediate assistance',
  category: 'dispatch',
  event_type: 'new_dispatch',
  priority: 'critical',
  requires_acknowledgment: true,
  deviceToken: 'paramedic_device_token',
  recipientPhone: '+1234567890',
  recipientEmail: 'paramedic@hospital.local',
  payload: {
    dispatch_id: 'disp_123',
    patient_name: 'John Doe',
    location: '123 Main St, City, State',
    severity: 'Critical',
    eta: '5 minutes',
    medical_history: 'Diabetic, Hypertension',
    allergies: 'Penicillin'
  }
};

const result = await notificationService.send(notification);
console.log('Notification sent:', result.notificationId);
```

### Send Via Queue

```javascript
const notificationQueue = app.get('notificationQueue');

// Add to queue for batch processing
const job = await notificationQueue.enqueue(notification, {
  maxRetries: 3
});

console.log('Job queued:', job.id);
```

### Handle Acknowledgment

```javascript
app.post('/api/notifications/:notificationId/acknowledge', async (req, res) => {
  const { response } = req.body;
  const userId = req.user.id;

  const result = await notificationService.handleAcknowledgment(
    notificationId,
    userId,
    response
  );

  if (response === 'rejected') {
    // Re-dispatch to next ambulance
    eventEmitter.emit('ambulance-rejected', {
      dispatch_id: result.payload.dispatch_id,
      ambulance_id: req.user.ambulance_id
    });
  }
});
```

### Broadcast to All Paramedics

```javascript
const inappChannel = notificationService.channels.get('inapp');

const systemAlert =