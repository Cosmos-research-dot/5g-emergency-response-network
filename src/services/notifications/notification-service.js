/**
 * Core Notification Service
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../../db/pool');
const SMSChannelAdapter = require('./channels/sms-channel');
const WhatsAppChannelAdapter = require('./channels/whatsapp-channel');
const PushChannelAdapter = require('./channels/push-channel');
const EmailChannelAdapter = require('./channels/email-channel');
const InAppChannelAdapter = require('./channels/inapp-channel');
const IntercomChannelAdapter = require('./channels/intercom-channel');

class NotificationService {
  constructor(config = {}) {
    this.config = config;
    this.channels = new Map();
    this.templates = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('[NotificationService] Initializing...');

      // Initialize channels
      const channels = [
        { name: 'sms', adapter: SMSChannelAdapter },
        { name: 'whatsapp', adapter: WhatsAppChannelAdapter },
        { name: 'push', adapter: PushChannelAdapter },
        { name: 'email', adapter: EmailChannelAdapter },
        { name: 'inapp', adapter: InAppChannelAdapter },
        { name: 'intercom', adapter: IntercomChannelAdapter }
      ];

      for (const { name, adapter } of channels) {
        try {
          const instance = new adapter(this.config);
          await instance.initialize();
          this.channels.set(name, instance);
        } catch (error) {
          console.warn(`[${name}] Initialization failed:`, error.message);
        }
      }

      await this.loadTemplates();
      this.isInitialized = true;
      console.log(`[NotificationService] ✓ Initialized with ${this.channels.size} channels`);
      return true;
    } catch (error) {
      console.error('[NotificationService] Initialization failed:', error);
      throw error;
    }
  }

  async loadTemplates() {
    try {
      const result = await pool.query('SELECT * FROM notification_templates');
      result.rows.forEach(template => {
        this.templates.set(template.code, template);
      });
    } catch (error) {
      console.warn('[NotificationService] Failed to load templates:', error.message);
    }
  }

  async send(notification) {
    try {
      const notificationId = notification.notification_id || uuidv4();
      notification.notification_id = notificationId;

      const preferences = await this.getUserPreferences(notification.user_id);
      const channels = this.determineChannels(notification, preferences);

      const isQuietHours = this.isInQuietHours(preferences);
      const shouldOverride = notification.priority === 'critical' && preferences.dnd_override_critical;

      const dbNotification = await this.storeNotification(notification);

      const results = [];
      for (const channelName of channels) {
        try {
          const channel = this.channels.get(channelName);
          if (!channel || !channel.isAvailable()) continue;

          if (channelName === 'push' && isQuietHours && !shouldOverride) {
            continue;
          }

          const formatted = this.formatForChannel(notification, channelName, preferences);
          const result = await channel.send(formatted);
          await this.recordChannelResult(dbNotification.id, channelName, result);
          results.push({ channel: channelName, result });
        } catch (error) {
          console.error(`Channel ${channelName} failed:`, error.message);
        }
      }

      return {
        success: true,
        notificationId,
        dbNotification,
        channelResults: results
      };
    } catch (error) {
      console.error('[NotificationService] Send failed:', error);
      throw error;
    }
  }

  determineChannels(notification, preferences) {
    const channels = [];
    const { priority } = notification;

    if (preferences.inapp_enabled) {
      channels.push('inapp');
    }

    if (priority === 'critical' || priority === 'urgent') {
      if (preferences.push_enabled) channels.push('push');
      if (preferences.sms_enabled) channels.push('sms');
    } else if (priority === 'normal') {
      if (preferences.push_enabled) channels.push('push');
    }

    if (notification.category === 'dispatch' && preferences.email_enabled) {
      channels.push('email');
    }

    if (preferences.whatsapp_enabled && preferences.whatsapp_verified) {
      channels.push('whatsapp');
    }

    return [...new Set(channels)];
  }

  formatForChannel(notification, channelName, preferences) {
    const formatted = { ...notification };
    formatted.language = preferences.language || 'en';

    switch (channelName) {
      case 'sms':
        formatted.recipientPhone = preferences.phone || notification.recipientPhone;
        break;
      case 'whatsapp':
        formatted.recipientPhone = preferences.whatsapp_phone || notification.recipientPhone;
        break;
      case 'email':
        formatted.recipientEmail = notification.recipientEmail;
        break;
      case 'push':
        formatted.deviceToken = notification.deviceToken;
        break;
    }

    return formatted;
  }

  async storeNotification(notification) {
    try {
      const {
        user_id,
        title,
        body,
        category,
        event_type,
        priority = 'normal',
        notification_id,
        payload,
        requires_acknowledgment = false,
        language = 'en'
      } = notification;

      const query = `
        INSERT INTO notifications (
          notification_id, user_id, title, body, category, event_type,
          priority, language, status, requires_acknowledgment, payload, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, CURRENT_TIMESTAMP)
        RETURNING id, notification_id
      `;

      const result = await pool.query(query, [
        notification_id, user_id, title, body, category, event_type,
        priority, language, requires_acknowledgment, payload ? JSON.stringify(payload) : null
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to store notification:', error.message);
      throw error;
    }
  }

  async recordChannelResult(notificationId, channelType, result) {
    try {
      const query = `
        INSERT INTO notification_channels (
          notification_id, channel_type, status, provider_message_id,
          error_code, error_message, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;

      const status = result.success ? 'sent' : 'failed';
      await pool.query(query, [
        notificationId,
        channelType,
        status,
        result.messageId,
        result.errorCode,
        result.error
      ]);
    } catch (error) {
      console.error('Failed to record channel result:', error.message);
    }
  }

  async getUserPreferences(userId) {
    try {
      const query = `
        SELECT * FROM notification_preferences WHERE user_id = $1
      `;
      const result = await pool.query(query, [userId]);
      return result.rows[0] || this.getDefaultPreferences();
    } catch (error) {
      console.error('Failed to get user preferences:', error.message);
      return this.getDefaultPreferences();
    }
  }

  getDefaultPreferences() {
    return {
      push_enabled: true,
      sms_enabled: true,
      whatsapp_enabled: false,
      email_enabled: true,
      inapp_enabled: true,
      dnd_enabled: false,
      dnd_start_time: '23:00:00',
      dnd_end_time: '08:00:00',
      dnd_override_critical: true,
      language: 'en'
    };
  }

  isInQuietHours(preferences) {
    if (!preferences.dnd_enabled) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

    const startTime = preferences.dnd_start_time;
    const endTime = preferences.dnd_end_time;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  async handleAcknowledgment(notificationId, userId, response) {
    try {
      const query = `
        UPDATE notifications SET acknowledged = true, acknowledged_at = CURRENT_TIMESTAMP,
        acknowledgment_response = $1 WHERE id = $2 AND user_id = $3
        RETURNING *
      `;
      
      const result = await pool.query(query, [response, notificationId, userId]);
      
      // Record acknowledgment
      await pool.query(`
        INSERT INTO notification_acknowledgments (
          notification_id, user_id, response_type, response_timestamp
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [notificationId, userId, response]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to handle acknowledgment:', error.message);
      throw error;
    }
  }

  getChannelStatus() {
    const status = {};
    this.channels.forEach((channel, name) => {
      status[name] = {
        available: channel.isAvailable(),
        metadata: channel.getMetadata()
      };
    });
    return status;
  }
}

module.exports = NotificationService;