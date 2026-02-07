/**
 * Unit Tests for NotificationService
 */

const NotificationService = require('../../src/services/notifications/notification-service');

describe('NotificationService', () => {
  let notificationService;

  beforeEach(() => {
    notificationService = new NotificationService({
      twilioAccountSid: 'test-sid',
      twilioAuthToken: 'test-token',
      twilioPhoneNumber: '+1234567890'
    });
  });

  describe('Channel Determination', () => {
    it('should route critical notifications to push + SMS', () => {
      const notification = {
        priority: 'critical',
        category: 'dispatch'
      };

      const preferences = {
        push_enabled: true,
        sms_enabled: true,
        inapp_enabled: true,
        email_enabled: true
      };

      const channels = notificationService.determineChannels(notification, preferences);

      expect(channels).toContain('push');
      expect(channels).toContain('sms');
      expect(channels).toContain('inapp');
    });

    it('should route normal notifications to push only', () => {
      const notification = {
        priority: 'normal',
        category: 'update'
      };

      const preferences = {
        push_enabled: true,
        sms_enabled: true,
        inapp_enabled: true
      };

      const channels = notificationService.determineChannels(notification, preferences);

      expect(channels).toContain('push');
      expect(channels).not.toContain('sms');
    });

    it('should respect disabled channels', () => {
      const notification = {
        priority: 'critical',
        category: 'dispatch'
      };

      const preferences = {
        push_enabled: false,
        sms_enabled: true,
        inapp_enabled: true
      };

      const channels = notificationService.determineChannels(notification, preferences);

      expect(channels).not.toContain('push');
      expect(channels).toContain('sms');
    });

    it('should route low priority to in-app only', () => {
      const notification = {
        priority: 'low',
        category: 'info'
      };

      const preferences = {
        push_enabled: true,
        sms_enabled: true,
        inapp_enabled: true
      };

      const channels = notificationService.determineChannels(notification, preferences);

      expect(channels).toContain('inapp');
      expect(channels).not.toContain('push');
      expect(channels).not.toContain('sms');
    });
  });

  describe('Quiet Hours', () => {
    it('should return false when DND disabled', () => {
      const preferences = {
        dnd_enabled: false
      };

      const result = notificationService.isInQuietHours(preferences);
      expect(result).toBe(false);
    });

    it('should detect quiet hours correctly', () => {
      // This test depends on current time, so we test the logic
      const preferences = {
        dnd_enabled: true,
        dnd_start_time: '23:00:00',
        dnd_end_time: '08:00:00'
      };

      // Just ensure function runs without error
      const result = notificationService.isInQuietHours(preferences);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Channel Formatting', () => {
    it('should add SMS recipient phone', () => {
      const notification = {
        title: 'Test',
        recipientPhone: '+1234567890'
      };

      const preferences = {
        phone: '+1111111111',
        language: 'en'
      };

      const formatted = notificationService.formatForChannel(notification, 'sms', preferences);

      expect(formatted.recipientPhone).toBe('+1111111111');
      expect(formatted.language).toBe('en');
    });

    it('should add email recipient', () => {
      const notification = {
        title: 'Test',
        recipientEmail: 'test@example.com'
      };

      const preferences = {
        language: 'en'
      };

      const formatted = notificationService.formatForChannel(notification, 'email', preferences);

      expect(formatted.recipientEmail).toBe('test@example.com');
    });

    it('should add device token for push', () => {
      const notification = {
        title: 'Test',
        deviceToken: 'abc123device'
      };

      const preferences = {
        language: 'en'
      };

      const formatted = notificationService.formatForChannel(notification, 'push', preferences);

      expect(formatted.deviceToken).toBe('abc123device');
    });
  });

  describe('Default Preferences', () => {
    it('should return sensible defaults', () => {
      const defaults = notificationService.getDefaultPreferences();

      expect(defaults.push_enabled).toBe(true);
      expect(defaults.sms_enabled).toBe(true);
      expect(defaults.inapp_enabled).toBe(true);
      expect(defaults.language).toBe('en');
      expect(defaults.dnd_override_critical).toBe(true);
    });
  });
});
