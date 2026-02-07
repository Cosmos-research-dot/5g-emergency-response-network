# Notifications System Setup Guide

## Prerequisites

- Node.js 14+
- PostgreSQL 12+
- Redis 6+
- Twilio account (for SMS/WhatsApp)
- Firebase project (for push notifications)
- SendGrid account (for email)

## Installation Steps

### 1. Install Dependencies

```bash
npm install bull redis twilio firebase-admin @sendgrid/mail nodemailer
```

### 2. Database Setup

#### Create Notification Tables

Run the migration:

```bash
node -e "require('./src/db/init').runMigrations()"
```

The `004-notifications-system.sql` migration creates all necessary tables:
- `notification_preferences`
- `notification_templates`
- `notifications`
- `notification_channels`
- `notification_queue`
- `notification_acknowledgments`
- `notification_analytics`

#### Seed Templates

```javascript
const { seedNotificationTemplates } = require('./src/db/seeds/notification-templates');
await seedNotificationTemplates();
```

### 3. Twilio Configuration

#### Set up SMS

1. Create Twilio account at https://www.twilio.com
2. Get your Account SID and Auth Token
3. Purchase a phone number (e.g., +1234567890)

```bash
export TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export TWILIO_AUTH_TOKEN=your_auth_token
export TWILIO_PHONE_NUMBER=+1234567890
```

#### Set up WhatsApp

1. Request WhatsApp Business account access
2. Configure approved template messages
3. Get WhatsApp-enabled phone number

```bash
export TWILIO_WHATSAPP_NUMBER=+1234567890
```

### 4. Firebase Configuration

#### Set up Cloud Messaging

1. Create Firebase project: https://console.firebase.google.com
2. Enable Cloud Messaging
3. Download service account key (JSON)

Option A: File path
```bash
export FIREBASE_CREDENTIALS_PATH=/path/to/serviceAccountKey.json
```

Option B: Environment variable
```bash
export FIREBASE_CONFIG='{"type":"service_account","project_id":"...","private_key":"..."}'
```

#### Configure APNs for iOS

1. Create Apple Developer account
2. Generate APNs certificate
3. Upload to Firebase

### 5. SendGrid Configuration

#### Set up Email

1. Create SendGrid account: https://sendgrid.com
2. Create API key
3. Verify sender email

```bash
export SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export EMAIL_FROM_ADDRESS=noreply@5g-emergency.local
```

#### Optional: SMTP Fallback

```bash
export SMTP_HOST=smtp.gmail.com
export SMTP_PORT=587
export SMTP_USER=your-email@gmail.com
export SMTP_PASSWORD=your-app-password
export SMTP_SECURE=false
```

### 6. Redis Configuration

```bash
export REDIS_URL=redis://localhost:6379

# Or for production with auth:
export REDIS_URL=redis://user:password@redis-server.example.com:6379
```

### 7. Hospital Intercom Setup (Optional)

For hospital speaker announcements:

```bash
export HOSPITAL_SPEAKERS_CONFIG='
{
  "hospital_1": {
    "speakerIps": ["192.168.1.10", "192.168.1.11"],
    "authToken": "hospital-api-token",
    "apiBaseUrl": "http://hospital-intercom-api.local:8080",
    "zones": ["emergency", "reception"]
  },
  "hospital_2": {
    "speakerIps": ["192.168.2.10"],
    "authToken": "hospital-2-token",
    "apiBaseUrl": "http://hospital2-api.local:8080",
    "zones": ["all"]
  }
}
'
```

## Application Integration

### Initialize in Express Server

```javascript
const express = require('express');
const NotificationService = require('./src/services/notifications/notification-service');
const NotificationQueue = require('./src/services/notifications/notification-queue');

const app = express();

// Initialize notification services on startup
app.listen(PORT, async () => {
  try {
    const notificationService = new NotificationService();
    await notificationService.initialize();

    const notificationQueue = new NotificationQueue();
    await notificationQueue.initialize(notificationService);

    app.set('notificationService', notificationService);
    app.set('notificationQueue', notificationQueue);

    console.log('✓ Notification services initialized');
  } catch (error) {
    console.error('Failed to initialize notifications:', error);
    process.exit(1);
  }
});
```

### Register API Routes

```javascript
const notificationsRouter = require('./src/routes/notifications');

app.use('/api/notifications', notificationsRouter);
```

### Register WebSocket Handler (In-App)

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const userId = req.user.id; // Extract from auth token

  const inappChannel = notificationService.channels.get('inapp');
  inappChannel.registerConnection(userId, ws);

  ws.on('close', () => {
    inappChannel.unregisterConnection(userId, ws);
  });
});
```

## Testing

### Unit Tests

```bash
npm test -- tests/unit/notification-service.test.js
```

### Integration Tests

```bash
npm test -- tests/integration/
```

### Manual Testing with Twilio

Use Twilio's test credentials:

```bash
export TWILIO_ACCOUNT_SID=ACxxxxxxxx  # Test SID
export TWILIO_AUTH_TOKEN=auth_token   # Test token
```

Send test SMS:

```javascript
const SMSChannel = require('./src/services/notifications/channels/sms-channel');

const channel = new SMSChannel();
await channel.initialize();

const result = await channel.send({
  recipientPhone: '+1234567890',
  title: 'Test SMS',
  body: 'This is a test notification',
  priority: 'normal'
});

console.log('Test SMS sent:', result);
```

### Load Testing

Test 1000 notifications/minute:

```bash
npm run test:load
```

## Monitoring

### Check Channel Status

```javascript
const status = notificationService.getChannelStatus();
console.log(status);

/*
Output:
{
  sms: { available: true, metadata: { ... } },
  whatsapp: { available: true, metadata: { ... } },
  push: { available: true, metadata: { ... } },
  email: { available: true, metadata: { ... } },
  inapp: { available: true, metadata: { ... } },
  intercom: { available: true, metadata: { ... } }
}
*/
```

### Queue Statistics

```javascript
const queue = app.get('notificationQueue');
const stats = await queue.getStats();
console.log(stats);

/*
Output:
{
  queued: 45,
  processing: 3,
  completed: 1203,
  failed: 12,
  delayed: 5,
  database: {
    pending: 45,
    processing: 3,
    completed: 1203,
    failed: 12
  }
}
*/
```

### Check User Online Status

```javascript
const inappChannel = notificationService.channels.get('inapp');
const isOnline = inappChannel.isUserOnline(userId);
console.log(`User ${userId} online:`, isOnline);
```

## Troubleshooting

### SMS Not Sending

1. Verify Twilio credentials are correct
2. Check phone number format (E.164: +1234567890)
3. Ensure Twilio account has SMS capability
4. Check account balance

### Push Notifications Not Delivered

1. Verify Firebase credentials and project ID
2. Check device token is valid
3. Ensure app has push permission
4. Check APNs certificate is active

### Email Not Sending

1. Verify SendGrid API key
2. Check sender email is verified
3. Ensure SMTP settings if using fallback
4. Check email address format

### Queue Not Processing

1. Verify Redis is running: `redis-cli ping`
2. Check Redis URL is correct
3. Monitor Bull queue dashboard (if configured)
4. Check database connectivity

### Quiet Hours Not Working

1. Verify user has DND enabled
2. Check system time is set correctly
3. Ensure DND start/end times are in 24-hour format
4. Verify dnd_override_critical is set for critical messages

## Best Practices

1. **Use Queue for Batch Operations**: Always queue notifications for better reliability
2. **Set Reasonable Timeouts**: Acknowledgment timeouts should be 30-60 seconds