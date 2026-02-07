/**
 * Push Notification Channel Adapter
 * Sends notifications via Firebase Cloud Messaging and Apple Push Notification service
 */

const BaseChannelAdapter = require('../base-channel');
const admin = require('firebase-admin');

class PushChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'push';
    this.firebaseApp = null;
  }

  async initialize() {
    try {
      const credentialsPath = this.config.firebaseCredentialsPath || 
                             process.env.FIREBASE_CREDENTIALS_PATH;

      if (!credentialsPath) {
        // If no explicit path, check for FIREBASE_CONFIG env var
        const firebaseConfig = process.env.FIREBASE_CONFIG;
        if (firebaseConfig) {
          const credentials = JSON.parse(firebaseConfig);
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(credentials)
          });
        } else {
          console.warn('[Push] Firebase credentials not configured, using default');
          this.firebaseApp = admin.app();
        }
      } else {
        const credentials = require(credentialsPath);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentials)
        });
      }

      await super.initialize();
      console.log('[Push] Firebase Cloud Messaging initialized');
    } catch (error) {
      console.error('[Push] Initialization failed:', error.message);
      // Continue without FCM - it's okay if not configured
      await super.initialize();
    }
  }

  validateRecipient(deviceToken) {
    return deviceToken && typeof deviceToken === 'string' && deviceToken.length > 10;
  }

  async send(notification) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Push notification channel not initialized');
      }

      const { deviceToken, title, body, payload, priority } = notification;

      if (!this.validateRecipient(deviceToken)) {
        throw new Error(`Invalid device token: ${deviceToken}`);
      }

      const message = {
        notification: {
          title: title || 'Emergency Alert',
          body: body || 'You have a new notification'
        },
        data: this.buildDataPayload(notification),
        android: {
          priority: this.mapPriority(priority),
          notification: {
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            sound: 'default',
            // Color for LED notification
            color: this.getColorForPriority(priority)
          }
        },
        apns: {
          headers: {
            'apns-priority': priority === 'critical' ? '10' : '10'
          },
          payload: {
            aps: {
              alert: {
                title: title,
                body: body
              },
              sound: priority === 'critical' ? 'default' : 'default',
              badge: 1,
              'mutable-content': true
            }
          }
        },
        webpush: {
          notification: {
            title: title,
            body: body,
            icon: '/assets/notification-icon.png',
            badge: '/assets/notification-badge.png'
          }
        }
      };

      const response = await admin.messaging().send(message, { to: deviceToken });

      return {
        success: true,
        messageId: response,
        providerId: 'firebase',
        providerResponse: {
          messageId: response
        },
        sentAt: new Date(),
        channel: 'push'
      };
    } catch (error) {
      console.error('[Push] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: error.code || 'PUSH_SEND_FAILED',
        channel: 'push'
      };
    }
  }

  /**
   * Send to multiple devices
   */
  async sendMulticast(deviceTokens, notification) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Push notification channel not initialized');
      }

      const message = {
        notification: {
          title: notification.title || 'Emergency Alert',
          body: notification.body || 'New notification'
        },
        data: this.buildDataPayload(notification),
        android: {
          priority: this.mapPriority(notification.priority)
        }
      };

      const response = await admin.messaging().sendMulticast({
        tokens: deviceTokens,
        notification: message.notification,
        data: message.data,
        android: message.android
      });

      return {
        success: response.successCount > 0,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses,
        channel: 'push'
      };
    } catch (error) {
      console.error('[Push] Multicast send failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'push'
      };
    }
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(deviceTokens, topic) {
    try {
      await admin.messaging().subscribeToTopic(deviceTokens, topic);
      return { success: true };
    } catch (error) {
      console.error('[Push] Topic subscription failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(deviceTokens, topic) {
    try {
      await admin.messaging().unsubscribeFromTopic(deviceTokens, topic);
      return { success: true };
    } catch (error) {
      console.error('[Push] Topic unsubscription failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  buildDataPayload(notification) {
    const data = {
      notificationId: notification.notificationId || '',
      category: notification.category || '',
      eventType: notification.eventType || '',
      priority: notification.priority || 'normal',
      timestamp: new Date().toISOString()
    };

    if (notification.payload) {
      Object.keys(notification.payload).forEach(key => {
        data[key] = String(notification.payload[key]);
      });
    }

    return data;
  }

  mapPriority(priority) {
    switch (priority) {
      case 'critical':
      case 'urgent':
        return 'high';
      case 'normal':
        return 'normal';
      case 'low':
        return 'low';
      default:
        return 'normal';
    }
  }

  getColorForPriority(priority) {
    switch (priority) {
      case 'critical':
        return '#FF0000'; // Red
      case 'urgent':
        return '#FF9800'; // Orange
      case 'normal':
        return '#2196F3'; // Blue
      default:
        return '#808080'; // Gray
    }
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: true,
        supportsDeliveryTracking: true,
        supportsRichMedia: true,
        supportsTopics: true,
        supportsMulticast: true,
        maxMessageLength: 4000
      }
    };
  }
}

module.exports = PushChannelAdapter;
