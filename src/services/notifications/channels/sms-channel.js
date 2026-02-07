/**
 * SMS Channel Adapter
 * Sends notifications via Twilio SMS
 */

const BaseChannelAdapter = require('../base-channel');
const twilio = require('twilio');

class SMSChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'sms';
    this.twilioClient = null;
    this.fromNumber = config.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;
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
      console.log('[SMS] Twilio SMS channel initialized');
    } catch (error) {
      console.error('[SMS] Initialization failed:', error.message);
      throw error;
    }
  }

  validateRecipient(recipient) {
    return /^\+?[1-9]\d{1,14}$/.test(recipient);
  }

  async send(notification) {
    try {
      if (!this.isAvailable()) {
        throw new Error('SMS channel not initialized');
      }

      const { recipientPhone, body, title, payload } = notification;

      if (!this.validateRecipient(recipientPhone)) {
        throw new Error(`Invalid phone number format: ${recipientPhone}`);
      }

      // Format message
      const message = this.formatMessage(notification);

      // Send SMS
      const result = await this.twilioClient.messages.create({
        body: message,
        from: this.fromNumber,
        to: recipientPhone
      });

      return {
        success: true,
        messageId: result.sid,
        providerId: 'twilio',
        providerResponse: {
          sid: result.sid,
          status: result.status,
          numSegments: result.numSegments
        },
        sentAt: new Date(),
        channel: 'sms'
      };
    } catch (error) {
      console.error('[SMS] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: error.code || 'SMS_SEND_FAILED',
        channel: 'sms'
      };
    }
  }

  formatMessage(notification) {
    const { title, body, payload } = notification;
    const maxLength = 160;

    // Build message with appropriate urgency indicators
    let message = '';
    if (notification.priority === 'critical') {
      message += '🚨 CRITICAL: ';
    } else if (notification.priority === 'urgent') {
      message += '⚠️ URGENT: ';
    }

    message += title || body;

    // Add quick response options for acknowledgment-required messages
    if (notification.requires_acknowledgment) {
      message += '\n\nReply: Y=Accept, N=Decline';
    }

    // Truncate if necessary
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }

    return message;
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: true,
        supportsDeliveryTracking: true,
        supportsRichMedia: false,
        maxMessageLength: 160,
        supportsUnicode: true
      }
    };
  }
}

module.exports = SMSChannelAdapter;
