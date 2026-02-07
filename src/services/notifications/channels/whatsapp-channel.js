/**
 * WhatsApp Channel Adapter
 * Sends notifications via Twilio WhatsApp API
 */

const BaseChannelAdapter = require('../base-channel');
const twilio = require('twilio');

class WhatsAppChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'whatsapp';
    this.twilioClient = null;
    this.fromNumber = config.twilioWhatsAppNumber || process.env.TWILIO_WHATSAPP_NUMBER;
  }

  async initialize() {
    try {
      const accountSid = this.config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
      const authToken = this.config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;

      if (!accountSid || !authToken) {
        throw new Error('Twilio credentials not configured');
      }

      this.twilioClient = twilio(accountSid, authToken);
      await super.initialize();
      console.log('[WhatsApp] Twilio WhatsApp channel initialized');
    } catch (error) {
      console.error('[WhatsApp] Initialization failed:', error.message);
      throw error;
    }
  }

  validateRecipient(recipient) {
    return /^\+?[1-9]\d{1,14}$/.test(recipient);
  }

  async send(notification) {
    try {
      if (!this.isAvailable()) {
        throw new Error('WhatsApp channel not initialized');
      }

      const { recipientPhone, body, title, payload } = notification;

      if (!this.validateRecipient(recipientPhone)) {
        throw new Error(`Invalid phone number: ${recipientPhone}`);
      }

      const message = this.formatMessage(notification);

      // Send WhatsApp message
      const result = await this.twilioClient.messages.create({
        body: message,
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${recipientPhone}`
      });

      return {
        success: true,
        messageId: result.sid,
        providerId: 'twilio-whatsapp',
        providerResponse: {
          sid: result.sid,
          status: result.status
        },
        sentAt: new Date(),
        channel: 'whatsapp'
      };
    } catch (error) {
      console.error('[WhatsApp] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: error.code || 'WHATSAPP_SEND_FAILED',
        channel: 'whatsapp'
      };
    }
  }

  formatMessage(notification) {
    const { title, body, payload, requires_acknowledgment } = notification;

    let message = '';

    // Add priority indicator with emoji
    if (notification.priority === 'critical') {
      message += '🚨 *CRITICAL ALERT*\n\n';
    } else if (notification.priority === 'urgent') {
      message += '⚠️ *URGENT*\n\n';
    }

    message += `*${title}*\n\n`;
    message += body;

    // Add event details if available
    if (payload) {
      if (payload.patient_name) {
        message += `\n\n👤 Patient: ${payload.patient_name}`;
      }
      if (payload.location) {
        message += `\n📍 Location: ${payload.location}`;
      }
      if (payload.eta) {
        message += `\n⏱️ ETA: ${payload.eta}`;
      }
      if (payload.severity) {
        message += `\n⚠️ Severity: ${payload.severity}`;
      }
    }

    // Add action buttons for acknowledgment
    if (requires_acknowledgment) {
      message += '\n\n_Reply with:_\n✅ YES - To accept\n❌ NO - To decline';
    }

    return message;
  }

  /**
   * Send WhatsApp message with quick reply buttons
   */
  async sendWithButtons(notification, buttons) {
    try {
      if (!this.isAvailable()) {
        throw new Error('WhatsApp channel not initialized');
      }

      const { recipientPhone, body, title } = notification;

      // Note: Twilio WhatsApp API has limited button support
      // This is a reference implementation
      const message = this.formatMessage(notification);

      const result = await this.twilioClient.messages.create({
        body: message,
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${recipientPhone}`
      });

      return {
        success: true,
        messageId: result.sid,
        channel: 'whatsapp'
      };
    } catch (error) {
      console.error('[WhatsApp] Send with buttons failed:', error.message);
      return {
        success: false,
        error: error.message,
        channel: 'whatsapp'
      };
    }
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: true,
        supportsDeliveryTracking: true,
        supportsRichMedia: true,
        maxMessageLength: 4096,
        supportsButtons: false,
        supportsMedia: true
      }
    };
  }
}

module.exports = WhatsAppChannelAdapter;
