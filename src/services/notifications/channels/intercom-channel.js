/**
 * Hospital Intercom Channel Adapter
 * Sends speaker notifications to hospital intercom systems
 */

const BaseChannelAdapter = require('../base-channel');
const axios = require('axios');

class IntercomChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'intercom';
    this.hospitalSpeakers = new Map(); // hospital_id -> { speaker_ips: [], auth_token: '' }
  }

  async initialize() {
    try {
      // Register known hospital speakers
      const speakers = this.config.hospitalSpeakers || {};
      Object.entries(speakers).forEach(([hospitalId, config]) => {
        this.registerHospitalSpeakers(hospitalId, config);
      });

      await super.initialize();
      console.log('[Intercom] Hospital intercom channel initialized');
    } catch (error) {
      console.error('[Intercom] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Register hospital speaker system
   */
  registerHospitalSpeakers(hospitalId, speakerConfig) {
    this.hospitalSpeakers.set(hospitalId, {
      speakerIps: speakerConfig.speakerIps || [],
      authToken: speakerConfig.authToken,
      apiBaseUrl: speakerConfig.apiBaseUrl || 'http://localhost:8080',
      zones: speakerConfig.zones || ['all']
    });
  }

  /**
   * Get speaker configuration for hospital
   */
  getHospitalSpeakers(hospitalId) {
    return this.hospitalSpeakers.get(hospitalId);
  }

  async send(notification) {
    try {
      const { hospitalId, body, priority, payload } = notification;

      if (!hospitalId) {
        throw new Error('Hospital ID required for intercom notifications');
      }

      const speakerConfig = this.getHospitalSpeakers(hospitalId);
      if (!speakerConfig) {
        throw new Error(`No intercom system registered for hospital: ${hospitalId}`);
      }

      const announcementText = this.formatAnnouncement(notification);

      // Send to all registered speaker zones
      const results = [];
      for (const speakerIp of speakerConfig.speakerIps) {
        try {
          const result = await this.sendToSpeaker(speakerIp, speakerConfig, announcementText, notification);
          results.push(result);
        } catch (error) {
          console.error(`[Intercom] Failed to send to speaker ${speakerIp}:`, error.message);
          results.push({
            success: false,
            speakerIp,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      return {
        success: successCount > 0,
        successCount,
        failureCount: results.length - successCount,
        totalSpeakers: results.length,
        results,
        channel: 'intercom',
        sentAt: new Date()
      };
    } catch (error) {
      console.error('[Intercom] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: 'INTERCOM_SEND_FAILED',
        channel: 'intercom'
      };
    }
  }

  /**
   * Send announcement to specific speaker
   */
  async sendToSpeaker(speakerIp, speakerConfig, announcementText, notification) {
    try {
      const endpoint = `${speakerConfig.apiBaseUrl}/api/announce`;

      const payload = {
        text: announcementText,
        zones: speakerConfig.zones,
        priority: notification.priority === 'critical' ? 'high' : 'normal',
        repeatCount: notification.priority === 'critical' ? 3 : 1,
        volume: notification.priority === 'critical' ? 100 : 80,
        language: notification.language || 'en'
      };

      const config = {
        headers: {}
      };

      if (speakerConfig.authToken) {
        config.headers['Authorization'] = `Bearer ${speakerConfig.authToken}`;
      }

      const response = await axios.post(endpoint, payload, config);

      return {
        success: response.status === 200 || response.status === 201,
        speakerIp,
        announcementId: response.data.announcementId,
        duration: response.data.duration || announcementText.split(' ').length * 0.5
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Send emergency tone before announcement (optional)
   */
  async sendEmergencyTone(hospitalId) {
    try {
      const speakerConfig = this.getHospitalSpeakers(hospitalId);
      if (!speakerConfig) {
        throw new Error(`No intercom system for hospital: ${hospitalId}`);
      }

      const endpoint = `${speakerConfig.apiBaseUrl}/api/tone`;
      const results = [];

      for (const speakerIp of speakerConfig.speakerIps) {
        try {
          const response = await axios.post(endpoint, {
            tone: 'emergency',
            duration: 2,
            zones: speakerConfig.zones
          });

          results.push({
            success: true,
            speakerIp
          });
        } catch (error) {
          results.push({
            success: false,
            speakerIp,
            error: error.message
          });
        }
      }

      return {
        success: results.some(r => r.success),
        results
      };
    } catch (error) {
      console.error('[Intercom] Emergency tone failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  formatAnnouncement(notification) {
    const { title, body, payload, priority, language } = notification;

    let announcement = '';

    // Add priority indicator
    if (priority === 'critical') {
      if (language === 'tr') {
        announcement += 'ÜRGENSİ UYARI. ';
      } else {
        announcement += 'CRITICAL ALERT. ';
      }
    }

    announcement += title + '. ';

    if (body) {
      announcement += body + '. ';
    }

    // Add key details
    if (payload) {
      if (payload.patient_name) {
        announcement += `Hasta: ${payload.patient_name}. `;
      }
      if (payload.severity) {
        announcement += `Şiddet: ${payload.severity}. `;
      }
      if (payload.eta) {
        announcement += `Tahmini varış: ${payload.eta}. `;
      }
    }

    if (notification.requires_acknowledgment) {
      if (language === 'tr') {
        announcement += 'Lütfen durum panosu aracılığıyla onaylayın.';
      } else {
        announcement += 'Please confirm via the status dashboard.';
      }
    }

    return announcement;
  }

  /**
   * Test speaker connectivity
   */
  async testSpeaker(hospitalId, speakerIp) {
    try {
      const speakerConfig = this.getHospitalSpeakers(hospitalId);
      if (!speakerConfig) {
        throw new Error(`No speakers configured for hospital: ${hospitalId}`);
      }

      const endpoint = `${speakerConfig.apiBaseUrl}/api/health`;
      const response = await axios.get(endpoint);

      return {
        success: response.status === 200,
        speakerIp,
        status: response.data.status
      };
    } catch (error) {
      return {
        success: false,
        speakerIp,
        error: error.message
      };
    }
  }

  /**
   * Test all speakers for a hospital
   */
  async testAllSpeakers(hospitalId) {
    try {
      const speakerConfig = this.getHospitalSpeakers(hospitalId);
      if (!speakerConfig) {
        throw new Error(`No speakers for hospital: ${hospitalId}`);
      }

      const results = [];
      for (const speakerIp of speakerConfig.speakerIps) {
        const result = await this.testSpeaker(hospitalId, speakerIp);
        results.push(result);
      }

      return {
        success: results.every(r => r.success),
        results
      };
    } catch (error) {
      console.error('[Intercom] Test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: false,
        supportsDeliveryTracking: false,
        supportsRichMedia: false,
        supportsMulticast: true,
        maxMessageLength: 500
      },
      registeredHospitals: Array.from(this.hospitalSpeakers.keys())
    };
  }
}

module.exports = IntercomChannelAdapter;