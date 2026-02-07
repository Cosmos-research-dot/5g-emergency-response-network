-- 001-init-schema.sql - Initial Database Schema for 5G Emergency Response Network

-- Users table (dispatch staff, hospital admins, paramedics)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  station_id UUID,
  hospital_id UUID,
  phone VARCHAR(20),
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hospitals table
CREATE TABLE IF NOT EXISTS hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(500),
  total_beds INT DEFAULT 0,
  available_beds INT DEFAULT 0,
  icu_beds INT DEFAULT 0,
  trauma_beds INT DEFAULT 0,
  burn_beds INT DEFAULT 0,
  pediatric_beds INT DEFAULT 0,
  has_trauma_center BOOLEAN DEFAULT FALSE,
  has_cardiac_center BOOLEAN DEFAULT FALSE,
  has_stroke_center BOOLEAN DEFAULT FALSE,
  has_burn_center BOOLEAN DEFAULT FALSE,
  district VARCHAR(255),
  status VARCHAR(50) DEFAULT 'OPERATIONAL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ambulance Stations
CREATE TABLE IF NOT EXISTS ambulance_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  latitude NUMERIC(10, 8) NOT NULL,
  longitude NUMERIC(11, 8) NOT NULL,
  phone VARCHAR(20),
  total_ambulances INT DEFAULT 0,
  available_ambulances INT DEFAULT 0,
  district VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ambulances table
CREATE TABLE IF NOT EXISTS ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sign VARCHAR(50) UNIQUE NOT NULL,
  station_id UUID NOT NULL REFERENCES ambulance_stations(id),
  license_plate VARCHAR(50) UNIQUE,
  vin VARCHAR(100),
  model VARCHAR(255),
  year INT,
  ambulance_type VARCHAR(50) DEFAULT 'TYPE_A',
  status VARCHAR(50) DEFAULT 'AVAILABLE',
  current_latitude NUMERIC(10, 8),
  current_longitude NUMERIC(11, 8),
  last_location_update TIMESTAMP,
  driver_id UUID REFERENCES users(id),
  paramedic_1_id UUID REFERENCES users(id),
  paramedic_2_id UUID REFERENCES users(id),
  current_dispatch_id UUID,
  fuel_level INT,
  battery_level INT,
  last_maintenance TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  age INT,
  gender VARCHAR(50),
  blood_type VARCHAR(10),
  phone VARCHAR(20),
  address VARCHAR(500),
  emergency_contact_name VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relation VARCHAR(100),
  medical_conditions TEXT,
  allergies TEXT,
  current_medications TEXT,
  status VARCHAR(50) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dispatches table
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_number VARCHAR(50) UNIQUE,
  caller_name VARCHAR(255),
  caller_phone VARCHAR(20),
  call_location_latitude NUMERIC(10, 8),
  call_location_longitude NUMERIC(11, 8),
  call_location_address VARCHAR(500),
  call_description TEXT,
  ambulance_id UUID REFERENCES ambulances(id),
  hospital_id UUID REFERENCES hospitals(id),
  patient_id UUID REFERENCES patients(id),
  dispatcher_id UUID REFERENCES users(id),
  call_received_at TIMESTAMP,
  ambulance_dispatched_at TIMESTAMP,
  ambulance_en_route_at TIMESTAMP,
  ambulance_on_scene_at TIMESTAMP,
  ambulance_transport_start_at TIMESTAMP,
  ambulance_arrival_at_hospital TIMESTAMP,
  status VARCHAR(50) DEFAULT 'PENDING',
  priority VARCHAR(50) DEFAULT 'NORMAL',
  triage_level VARCHAR(50),
  route_polyline TEXT,
  estimated_distance_km NUMERIC(10, 2),
  estimated_duration_sec INT,
  actual_duration_sec INT,
  patient_outcome VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vital Signs History
CREATE TABLE IF NOT EXISTS vital_signs_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  ambulance_id UUID REFERENCES ambulances(id),
  patient_id UUID REFERENCES patients(id),
  heart_rate INT,
  systolic_bp INT,
  diastolic_bp INT,
  respiratory_rate INT,
  temperature NUMERIC(5, 2),
  oxygen_saturation INT,
  blood_glucose INT,
  consciousness_level VARCHAR(50),
  pain_level INT,
  triage_level VARCHAR(50),
  triage_score NUMERIC(5, 2),
  recorded_by_user_id UUID REFERENCES users(id),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  network_latency_ms INT,
  network_signal_strength INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Response Metrics
CREATE TABLE IF NOT EXISTS response_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  response_time_sec INT,
  time_to_hospital_sec INT,
  on_scene_time_sec INT,
  dispatch_to_enroute_sec INT,
  dispatch_to_on_scene_sec INT,
  avg_5g_latency_ms NUMERIC(8, 2),
  avg_4g_latency_ms NUMERIC(8, 2),
  network_reliability_percent NUMERIC(5, 2),
  emergency_slice_activated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign keys to users table
ALTER TABLE users ADD CONSTRAINT fk_users_station FOREIGN KEY (station_id) REFERENCES ambulance_stations(id) ON DELETE SET NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_ambulances_status ON ambulances(status);
CREATE INDEX idx_ambulances_station ON ambulances(station_id);
CREATE INDEX idx_ambulances_location ON ambulances(current_latitude, current_longitude);
CREATE INDEX idx_dispatches_status ON dispatches(status);
CREATE INDEX idx_dispatches_ambulance ON dispatches(ambulance_id);
CREATE INDEX idx_dispatches_hospital ON dispatches(hospital_id);
CREATE INDEX idx_dispatches_patient ON dispatches(patient_id);
CREATE INDEX idx_dispatches_created ON dispatches(created_at);
CREATE INDEX idx_vital_signs_dispatch ON vital_signs_history(dispatch_id);
CREATE INDEX idx_vital_signs_ambulance ON vital_signs_history(ambulance_id);
CREATE INDEX idx_vital_signs_recorded ON vital_signs_history(recorded_at);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_hospitals_district ON hospitals(district);
CREATE INDEX idx_hospitals_location ON hospitals(latitude, longitude);