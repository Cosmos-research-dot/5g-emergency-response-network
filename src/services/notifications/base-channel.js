/**
 * Base Channel Adapter
 * Abstract base class for all notification channel implementations
 */

class BaseChannelAdapter {
  constructor(config = {}) {
    this.name = 'base';
    this.config = config;
    this.isInitialized = false;
    this.logger = console;
  }

  /**
   * Initialize the channel
   */
  async initialize() {
    this.isInitialized = true;
    this.logger.log(`[${this.name}] Channel initialized`);
  }

  /**
   * Send notification through this channel
   */
  async send(notification) {
    throw new Error('send() must be implemented by subclass');
  }

  /**
   * Validate recipient for this channel
   */
  validateRecipient(recipient) {
    return true;
  }

  /**
   * Check if channel is available
   */
  isAvailable() {
    return this.isInitialized;
  }

  /**
   * Handle delivery confirmation
   */
  async handleDeliveryCallback(data) {
    return { success: true };
  }

  /**
   * Format notification for this channel
   */
  formatNotification(notification) {
    return notification;
  }

  /**
   * Get channel-specific metadata
   */
  getMetadata() {
    return {
      name: this.name,
      type: this.name,
      isInitialized: this.isInitialized,
      capabilities: {
        supportsAck: false,
        supportsDeliveryTracking: false,
        supportsRichMedia: false,
        maxMessageLength: 160,
      }
    };
  }
}

module.exports = BaseChannelAdapter;
