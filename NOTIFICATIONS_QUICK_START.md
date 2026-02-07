# Notifications System - Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install bull redis twilio firebase-admin @sendgrid/mail nodemailer
```

### 2. Copy Environment Template
```bash
cp .env.example .env
```

### 3. Add Your Credentials to .env
```bash
# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Firebase
FIREBASE_CREDENTIALS_PATH=/path/to/serviceAccountKey.json

# SendGrid
SENDGRID_API_KEY=SG.xxxxxxxx
EMAIL_FROM_ADDRESS=noreply@5g-emergency.local

# Redis
REDIS_URL=redis://localhost:6379
```

### 4. Initialize Database
```bash
node -e "require('./src/db/init').initialize()"
```

### 5. Seed Templates
```javascript
const { seedNotificationTemplates } = require('./src/db/seeds/notification-templates');
await seedNotificationTemplates();
```

### 6. Start Server
```bash
npm start
```

## Common Use Cases

### Send a Critical Dispatch Alert
```javascript
const svc = app.get('notificationService');

await svc.send({
  user_id: 123,
  title: '🚨 New Emergency Call',
  body: 'Patient requires immediate assistance',
  category: 'dispatch',
  priority: 'critical',
  requires_acknowledgment: true,
  deviceToken: 'device_token',
  recipientPhone: '+1234567890',
  recipientEmail: 'paramedic@hospital.local',
  payload: {
    dispatch_id: 'disp_123',
    patient_name: 'John Doe',
    location: '123 Main St',
    severity: 'Critical'
  }
});
```

### Check User Preferences
```javascript
const prefs = await svc.getUserPreferences(userId);
console.log(prefs.dnd_enabled); // true/false
console.log(prefs.push_enabled); // true/false
```

### Get Queue Stats
```javascript
const queue = app.get('notificationQueue');
const stats = await queue.getStats();
console.log(`Queued: ${stats.queued}`);
console.log(`Processing: ${stats.processing}`);
```

### Handle Acknowledgment
```javascript
app.post('/acknowledge/:notificationId', async (req, res) => {
  const svc = app.get('notificationService');
  const result = await svc.handleAcknowledgment(
    notificationId,
    userId,
    'accepted' // or 'rejected'
  );
  res.json(result);
});
```

## API Endpoints

```bash
# Get user preferences
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/notifications/preferences

# Update preferences
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dnd_enabled": true}' \
  http://localhost:3000/api/notifications/preferences

# Get notifications
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/notifications?category=dispatch&limit=10

# Acknowledge notification
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"response": "accepted"}' \
  http://localhost:3000/api/notifications/123/acknowledge
```

## Channels & Routing

```
Priority    → Channels Used
─────────────────────────────
CRITICAL    → Push + SMS
URGENT      → Push + SMS
NORMAL      → Push only
LOW         → In-app only
```

## File Structure
```
src/services/notifications/
  ├── notification-service.js      (Main orchestrator)
  ├── notification-queue.js        (Bull queue)
  └── channels/
      ├── sms-channel.js           (Twilio SMS)
      ├── whatsapp-channel.js      (Twilio WhatsApp)
      ├── push-channel.js          (Firebase FCM)
      ├── email-channel.js         (SendGrid)
      ├── inapp-channel.js         (WebSocket)
      └── intercom-channel.js      (Speaker systems)

src/routes/
  └── notifications.js             (REST API)

src/db/migrations/
  └── 004-notifications-system.sql (Database schema)

src/db/seeds/
  └── notification-templates.js    (Template seed)
```

## Troubleshooting

### Issue: SMS not sending
**Solution**: Check Twilio credentials and phone number format
```bash
# Test SMS channel
node -e "
const SMSChannel = require('./src/services/notifications/channels/sms-channel');
const ch = new SMSChannel();
ch.initialize().then(() => console.log('✓ SMS initialized'));
"
```

### Issue: Push notifications not delivering
**Solution**: Verify Firebase credentials and device token validity
```bash
# Check Firebase
node -e "
const admin = require('firebase-admin');
const credentials = require('./serviceAccountKey.json');
admin.initializeApp({credential: admin.credential.cert(credentials)});
console.log('✓ Firebase initialized');
"
```

### Issue: Queue not processing
**Solution**: Ensure Redis is running
```bash
redis-cli ping
# Should respond: PONG
```

## Testing

### Unit Tests
```bash
npm test
```

### Manual Send Test
```javascript
const NotificationService = require('./src/services/notifications/notification-service');
const service = new NotificationService();
await service.initialize();

const result = await service.send({
  user_id: 1,
  title: 'Test Notification',
  body: 'This is a test',
  category: 'test',
  priority: 'normal',
  deviceToken: 'test-device-token',
  recipientPhone: '+1234567890',
  recipientEmail: 'test@example.com'
});

console.log('Result:', result);
```

## Documentation

- **Full Setup**: See `NOTIFICATIONS_SETUP.md`
- **System Design**: See `NOTIFICATIONS_SYSTEM.md`
- **API Reference**: See `NOTIFICATIONS_SYSTEM.md`
- **Implementation**: See `NOTIFICATIONS_IMPLEMENTATION_COMPLETE.md`

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the complete setup guide
3. Check database schema for data structure
4. Review API endpoints documentation

---

**Status**: Production Ready ✓
**Last Updated**: February 7, 2026
