/**
 * Email Channel Adapter
 * Sends notifications via SendGrid and Nodemailer
 */

const BaseChannelAdapter = require('../base-channel');
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');

class EmailChannelAdapter extends BaseChannelAdapter {
  constructor(config = {}) {
    super(config);
    this.name = 'email';
    this.useSendGrid = config.useSendGrid !== false;
    this.transporter = null;
    this.fromEmail = config.fromEmail || process.env.EMAIL_FROM_ADDRESS || 'noreply@5g-emergency.local';
  }

  async initialize() {
    try {
      if (this.useSendGrid) {
        const sendGridApiKey = this.config.sendGridApiKey || process.env.SENDGRID_API_KEY;
        if (sendGridApiKey) {
          sgMail.setApiKey(sendGridApiKey);
          console.log('[Email] SendGrid initialized');
        } else {
          console.warn('[Email] SendGrid API key not found, using Nodemailer');
          this.useSendGrid = false;
        }
      }

      if (!this.useSendGrid) {
        this.transporter = nodemailer.createTransport({
          host: this.config.smtpHost || process.env.SMTP_HOST,
          port: this.config.smtpPort || process.env.SMTP_PORT || 587,
          secure: this.config.smtpSecure || process.env.SMTP_SECURE === 'true',
          auth: {
            user: this.config.smtpUser || process.env.SMTP_USER,
            pass: this.config.smtpPassword || process.env.SMTP_PASSWORD
          }
        });

        console.log('[Email] Nodemailer configured');
      }

      await super.initialize();
      console.log('[Email] Email channel initialized');
    } catch (error) {
      console.error('[Email] Initialization failed:', error.message);
      throw error;
    }
  }

  validateRecipient(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async send(notification) {
    try {
      if (!this.isAvailable()) {
        throw new Error('Email channel not initialized');
      }

      const { recipientEmail, title, body } = notification;

      if (!this.validateRecipient(recipientEmail)) {
        throw new Error(`Invalid email address: ${recipientEmail}`);
      }

      const { subject, htmlContent } = this.formatEmail(notification);

      if (this.useSendGrid) {
        return await this.sendViaSendGrid(recipientEmail, subject, htmlContent);
      } else {
        return await this.sendViaNodemailer(recipientEmail, subject, htmlContent);
      }
    } catch (error) {
      console.error('[Email] Send failed:', error.message);
      return {
        success: false,
        error: error.message,
        errorCode: error.code || 'EMAIL_SEND_FAILED',
        channel: 'email'
      };
    }
  }

  async sendViaSendGrid(email, subject, htmlContent) {
    try {
      const msg = {
        to: email,
        from: this.fromEmail,
        subject: subject,
        html: htmlContent
      };

      const response = await sgMail.send(msg);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        providerId: 'sendgrid',
        sentAt: new Date(),
        channel: 'email'
      };
    } catch (error) {
      throw error;
    }
  }

  async sendViaNodemailer(email, subject, htmlContent) {
    try {
      const result = await this.transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject: subject,
        html: htmlContent
      });

      return {
        success: true,
        messageId: result.messageId,
        providerId: 'nodemailer',
        sentAt: new Date(),
        channel: 'email'
      };
    } catch (error) {
      throw error;
    }
  }

  formatEmail(notification) {
    const { title, body, payload, priority } = notification;

    const priorityColor = this.getPriorityColor(priority);
    const priorityText = this.getPriorityText(priority);

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${priorityColor}; color: white; padding: 15px; }
          .content { background-color: #f9f9f9; padding: 20px; }
          .priority-badge { background-color: ${priorityColor}; color: white; padding: 5px 10px; }
          .details { background-color: white; padding: 15px; margin-top: 15px; border-left: 4px solid ${priorityColor}; }
          .detail-row { margin: 8px 0; }
          .detail-label { font-weight: bold; color: ${priorityColor}; }
          .footer { margin-top: 20px; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
            <div class="priority-badge">${priorityText}</div>
          </div>
          <div class="content">
            <p>${body}</p>
    `;

    if (payload) {
      htmlContent += '<div class="details">';
      if (payload.patient_name) {
        htmlContent += `<div class="detail-row"><span class="detail-label">Patient:</span> ${payload.patient_name}</div>`;
      }
      if (payload.location) {
        htmlContent += `<div class="detail-row"><span class="detail-label">Location:</span> ${payload.location}</div>`;
      }
      if (payload.severity) {
        htmlContent += `<div class="detail-row"><span class="detail-label">Severity:</span> ${payload.severity}</div>`;
      }
      if (payload.eta) {
        htmlContent += `<div class="detail-row"><span class="detail-label">ETA:</span> ${payload.eta}</div>`;
      }
      htmlContent += '</div>';
    }

    htmlContent += `
          </div>
          <div class="footer">
            <p>5G Emergency Response System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      subject: `[${priorityText}] ${title}`,
      htmlContent
    };
  }

  getPriorityColor(priority) {
    switch (priority) {
      case 'critical': return '#FF0000';
      case 'urgent': return '#FF9800';
      case 'normal': return '#2196F3';
      default: return '#808080';
    }
  }

  getPriorityText(priority) {
    switch (priority) {
      case 'critical': return 'CRITICAL';
      case 'urgent': return 'URGENT';
      case 'normal': return 'NORMAL';
      default: return 'INFO';
    }
  }

  getMetadata() {
    return {
      ...super.getMetadata(),
      capabilities: {
        supportsAck: false,
        supportsDeliveryTracking: false,
        supportsRichMedia: true,
        maxMessageLength: 10000
      }
    };
  }
}

module.exports = EmailChannelAdapter;
