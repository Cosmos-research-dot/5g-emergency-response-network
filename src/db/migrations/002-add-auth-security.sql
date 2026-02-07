-- 002-add-auth-security.sql - Add Authentication and Security features

-- Add authentication fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip_address INET;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_user_agent TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Create password history table (for preventing password reuse)
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create session tokens table (for managing active sessions)
CREATE TABLE IF NOT EXISTS session_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  refresh_token_hash VARCHAR(255),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  is_revoked BOOLEAN DEFAULT FALSE
);

-- Create password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP
);

-- Create enhanced audit log with more details
CREATE TABLE IF NOT EXISTS audit_log_detailed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  resource_name VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  status VARCHAR(50) DEFAULT 'SUCCESS',
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  session_id UUID,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create login audit table
CREATE TABLE IF NOT EXISTS login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  status VARCHAR(50) DEFAULT 'SUCCESS', -- SUCCESS, FAILED, LOCKED
  reason VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  device_info JSONB,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create data access audit (for sensitive data - HIPAA compliance)
CREATE TABLE IF NOT EXISTS data_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE SET NULL,
  access_type VARCHAR(50), -- READ, CREATE, UPDATE, DELETE
  accessed_fields JSONB,
  ip_address INET,
  user_agent TEXT,
  purpose VARCHAR(255),
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create API keys table (for service-to-service authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  description TEXT,
  permissions JSONB,
  last_used TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create encryption keys table (for field-level encryption)
CREATE TABLE IF NOT EXISTS encryption_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_version INT NOT NULL,
  key_hash VARCHAR(255),
  algorithm VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  active_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE
);

-- Update audit_log to add more fields for HIPAA compliance
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'SUCCESS';
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS session_id UUID;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_user ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires ON session_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log_detailed(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log_detailed(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log_detailed(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_user ON login_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_login_audit_timestamp ON login_audit(login_at);
CREATE INDEX IF NOT EXISTS idx_data_access_patient ON data_access_audit(patient_id);
CREATE INDEX IF NOT EXISTS idx_data_access_user ON data_access_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_data_access_timestamp ON data_access_audit(accessed_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- Add constraint for valid roles
ALTER TABLE users ADD CONSTRAINT check_valid_role CHECK (role IN ('ADMIN', 'DISPATCHER', 'HOSPITAL_ADMIN', 'PARAMEDIC', 'DOCTOR'));
