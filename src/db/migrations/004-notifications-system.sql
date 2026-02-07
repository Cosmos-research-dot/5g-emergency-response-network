-- Notifications System Tables
-- Comprehensive multi-channel notification system for 5G Emergency Response Network

-- Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Channel preferences
  push_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT true,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email_enabled BOOLEAN DEFAULT true,
  inapp_enabled BOOLEAN DEFAULT true,
  
  -- DND (Do Not Disturb) settings
  dnd_enabled BOOLEAN DEFAULT false,
  dnd_start_time TIME DEFAULT '23:00:00',
  dnd_end_time TIME DEFAULT '08:00:00',
  dnd_override_critical BOOLEAN DEFAULT true,
  
  -- Language preferences
  language VARCHAR(10) DEFAULT 'en',
  
  -- SMS preferences
  sms_only_critical BOOLEAN DEFAULT false,
  sms_max_per_day INT DEFAULT 50,
  
  -- Email preferences
  email_digest BOOLEAN DEFAULT true,
  email_digest_frequency VARCHAR(20) DEFAULT 'daily',
  
  -- WhatsApp preferences
  whatsapp_phone VARCHAR(20),
  whatsapp_verified BOOLEAN DEFAULT false,
  
  -- Push notification settings
  push_vibration BOOLEAN DEFAULT true,
  push_sound BOOLEAN DEFAULT true,
  push_badge BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Template content for each channel
  push_title VARCHAR(255),
  push_body TEXT,
  sms_template TEXT,
  whatsapp_template TEXT,
  email_subject VARCHAR(255),
  email_body TEXT,
  inapp_title VARCHAR(255),
  inapp_body TEXT,
  
  -- Metadata
  category VARCHAR(50),
  priority VARCHAR(20) DEFAULT 'normal',
  requires_acknowledgment BOOLEAN DEFAULT false,
  acknowledgment_timeout_seconds INT DEFAULT 60,
  
  variables JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  notification_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  
  -- Recipient
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_phone VARCHAR(20),
  recipient_email VARCHAR(255),
  
  -- Content
  template_id INT REFERENCES notification_templates(id),
  title VARCHAR(255),
  body TEXT,
  payload JSON,
  
  -- Classification
  category VARCHAR(50),
  event_type VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'normal',
  
  -- Language
  language VARCHAR(10) DEFAULT 'en',
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Acknowledgment
  requires_acknowledgment BOOLEAN DEFAULT false,
  acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP,
  acknowledgment_response VARCHAR(255),
  
  -- Retry information
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  last_retry_at TIMESTAMP,
  
  -- Scheduling
  scheduled_for TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  failed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Channels History
CREATE TABLE IF NOT EXISTS notification_channels (
  id SERIAL PRIMARY KEY,
  notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  
  -- Channel information
  channel_type VARCHAR(50),
  
  -- Recipient details
  recipient_identifier VARCHAR(255),
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  
  -- Provider response
  provider_message_id VARCHAR(255),
  provider_response JSON,
  
  -- Error information
  error_code VARCHAR(100),
  error_message TEXT,
  
  -- Retry tracking
  attempt_count INT DEFAULT 0,
  last_attempt_at TIMESTAMP,
  
  -- Delivery confirmation
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Queue Table
CREATE TABLE IF NOT EXISTS notification_queue (
  id SERIAL PRIMARY KEY,
  notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  queue_id VARCHAR(255) UNIQUE,
  
  status VARCHAR(50) DEFAULT 'pending',
  
  priority INT DEFAULT 0,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  
  scheduled_time TIMESTAMP,
  process_started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  last_error TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Acknowledgment History Table
CREATE TABLE IF NOT EXISTS notification_acknowledgments (
  id SERIAL PRIMARY KEY,
  notification_id INT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  response_type VARCHAR(50),
  response_value VARCHAR(255),
  response_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_channel VARCHAR(50),
  response_metadata JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification Analytics Table
CREATE TABLE IF NOT EXISTS notification_analytics (
  id SERIAL PRIMARY KEY,
  
  date_hour TIMESTAMP NOT NULL,
  
  category VARCHAR(50),
  channel_type VARCHAR(50),
  priority VARCHAR(20),
  
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_failed INT DEFAULT 0,
  total_acknowledged INT DEFAULT 0,
  
  avg_delivery_time_ms INT DEFAULT 0,
  avg_acknowledgment_time_s INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(channel_type, status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_templates_code ON notification_templates(code);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON notification_preferences(user_id);
