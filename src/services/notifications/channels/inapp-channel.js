/**
 * In-App Notification Channel Adapter
 * Sends notifications via WebSocket to connected clients
 */

const BaseChannelAdapter = require('../base-channel');
const EventEmitter = require('events');

class InAppChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'inapp';
    this.userSessions = new Map(); // user_id -> Set of websocket connections
    this.eventEmitter = new EventEmitter();
  }

  async initialize() {
    await super.initialize();
    console.log('[InApp] In-app notification channel initialized');
  }

  /**
   * Register a WebSocket connection for a user
   */
  registerConnection(userId, wsConnection) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId).add(wsConnection);
    
    wsConnection.on('close', () => {
      const sessions = this.userSessions.get(userId);
      if (sessions) {
        sessions.delete(wsConnection);
        if (sessions.size === 0) {
          this.userSessions.delete(userId);
        }
      }
    });
  }

  /**
   * Unregister a WebSocket connection
   */
  unregisterConnection(userId, wsConnection) {
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.delete(wsConnection);
      if (sessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  /**
   * Check if user is currently online
   */
  isUserOnline(userId) {
    return this.userSessions.has(userId) && this.userSessions.get(userId).size > 0;
  }

  async send(notification) {
    try {
      const { userId, title, body, payload, notificationId } = notification;

      if (!userId) {
        throw new Error('User ID required for in-app notifications');
      }

      const message = this.formatNotification(notification);

      // Send to all user connections
      const sessions = this.userSessions.get(userId);
      if (!sessions || sessions.size === 0) {
        return {
          success: false,
          error: 'User not online',
          errorCode: 'USER_OFFLINE',
          channel: 'inapp',
          queued: true // Mark for queuing when user comes online
        };
      }

      let successCount = 0;
      let failureCount = 0;

      sessions.forEach(ws => {
        try {
          ws.send(JSON.stringify(message));
          successCount++;
        } catch (error) {
          console.error('[InApp] Failed to send to connection:', error.message);
          failureCount++;
        }
      });

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        totalConnections: sessions.size,
        messageId: notificationId,
        sentAt: new Date(),
        channel: 'inapp'
      };
    } catch (error) {
      console.error('[InApp] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: 'INAPP_SEND_FAILED',
        channel: 'inapp'
      };
    }
  }

  /**
   * Broadcast to all connected users
   */
  async broadcast(notification) {
    try {
      const message = this.formatNotification(notification);
      let successCount = 0;
      let failureCount = 0;

      this.userSessions.forEach((sessions, userId) => {
        sessions.forEach(ws => {
          try {
            ws.send(JSON.stringify(message));
            successCount++;
          } catch (error) {
            failureCount++;
          }
        });
      });

      return {
        success: true,
        successCount,
        failureCount,
        channel: 'inapp'
      };
    } catch (error) {
      console.error('[InApp] Broadcast failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'inapp'
      };
    }
  }

  /**
   * Send to specific ambulance
   */
  async sendToAmbulance(ambulanceId, notification) {
    try {
      const message = this.formatNotification(notification);
      message.target = {
        type: 'ambulance',
        id: ambulanceId
      };

      // Send to ambulance paramedics (could be multiple users)
      this.eventEmitter.emit('ambulance-notification', ambulanceId, message);

      return {
        success: true,
        target: 'ambulance',
        targetId: ambulanceId,
        channel: 'inapp'
      };
    } catch (error) {
      console.error('[InApp] Ambulance send failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'inapp'
      };
    }
  }

  /**
   * Send to all dispatchers
   */
  async sendToDispatchers(notification) {
    try {
      const message = this.formatNotification(notification);
      message.target = {
        type: 'dispatcher'
      };

      this.eventEmitter.emit('dispatcher-notification', message);

      return {
        success: true,
        target: 'dispatcher_group',
        channel: 'inapp'
      };
    } catch (error) {
      console.error('[InApp] Dispatcher send failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'inapp'
      };
    }
  }

  /**
   * Send to all hospitals
   */
  async sendToHospitals(notification) {
    try {
      const message = this.formatNotification(notification);
      message.target = {
        type: 'hospital'
      };

      this.eventEmitter.emit('hospital-notification', message);

      return {
        success: true,
        target: 'hospital_group',
        channel: 'inapp'
      };
    } catch (error) {
      console.error('[InApp] Hospital send failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'inapp'
      };
    }
  }

  formatNotification(notification) {
    return {
      type: 'notification',
      id: notification.notificationId,
      title: notification.title,
      body: notification.body,
      category: notification.category,
      priority: notification.priority,
      eventType: notification.eventType,
      timestamp: new Date().toISOString(),
      payload: notification.payload || {},
      requiresAcknowledgment: notification.requires_acknowledgment || false,
      acknowledgmentDeadline: notification.requires_acknowledgment 
        ? new Date(Date.now() + 60000).toISOString()
        : null
    };
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: true,
        supportsDeliveryTracking: true,
        supportsRichMedia: true,
        supportsBroadcast: true,
        supportsTargeting: true,
        maxMessageLength: 100000
      },
      stats: {
        connectedUsers: this.userSessions.size,
        totalConnections: Array.from(this.userSessions.values()).reduce((sum, s) => sum + s.size, 0)
      }
    };
  }
}

module.exports = InAppChannelAdapter;
