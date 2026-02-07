-- Routing Analytics Tables

-- Store all routing recommendations and decisions
CREATE TABLE IF NOT EXISTS routing_analytics (
  id SERIAL PRIMARY KEY,
  route_id UUID NOT NULL UNIQUE,
  recommended_hospital UUID NOT NULL,
  recommended_score DECIMAL(5, 2) NOT NULL,
  patient_condition VARCHAR(50),
  severity VARCHAR(20),
  override BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (recommended_hospital) REFERENCES hospitals(id)
);

-- Track paramedic overrides
CREATE TABLE IF NOT EXISTS routing_overrides (
  id SERIAL PRIMARY KEY,
  route_id UUID NOT NULL UNIQUE,
  recommended_hospital UUID,
  actual_hospital UUID NOT NULL,
  override_reason TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (recommended_hospital) REFERENCES hospitals(id),
  FOREIGN KEY (actual_hospital) REFERENCES hospitals(id)
);

-- Hospital utilization tracking
CREATE TABLE IF NOT EXISTS hospital_utilization (
  id SERIAL PRIMARY KEY,
  hospital_id UUID NOT NULL,
  occupancy_rate DECIMAL(5, 2),
  available_beds INTEGER,
  ambulance_queue INTEGER,
  recorded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

-- Ambulance queue tracking
CREATE TABLE IF NOT EXISTS ambulance_queue_log (
  id SERIAL PRIMARY KEY,
  hospital_id UUID NOT NULL,
  ambulance_id UUID NOT NULL,
  action VARCHAR(20), -- 'added', 'removed', 'completed'
  queue_length INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
);

-- Load balancing decisions
CREATE TABLE IF NOT EXISTS load_balancing_log (
  id SERIAL PRIMARY KEY,
  ambulance_id UUID NOT NULL,
  from_hospital UUID,
  to_hospital UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id),
  FOREIGN KEY (from_hospital) REFERENCES hospitals(id),
  FOREIGN KEY (to_hospital) REFERENCES hospitals(id)
);

-- Response time tracking
CREATE TABLE IF NOT EXISTS response_times (
  id SERIAL PRIMARY KEY,
  ambulance_id UUID NOT NULL,
  call_time TIMESTAMP NOT NULL,
  dispatch_time TIMESTAMP,
  arrival_time TIMESTAMP,
  hospital_id UUID NOT NULL,
  response_minutes DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
);

-- Ambulance positioning log
CREATE TABLE IF NOT EXISTS ambulance_positioning_log (
  id SERIAL PRIMARY KEY,
  ambulance_id UUID NOT NULL,
  from_location POINT,
  to_location POINT,
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (ambulance_id) REFERENCES ambulances(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_routing_analytics_route_id ON routing_analytics(route_id);
CREATE INDEX idx_routing_analytics_hospital ON routing_analytics(recommended_hospital);
CREATE INDEX idx_routing_analytics_created ON routing_analytics(created_at);

CREATE INDEX idx_routing_overrides_route_id ON routing_overrides(route_id);
CREATE INDEX idx_routing_overrides_created ON routing_overrides(created_at);

CREATE INDEX idx_hospital_utilization_hospital ON hospital_utilization(hospital_id);
CREATE INDEX idx_hospital_utilization_recorded ON hospital_utilization(recorded_at);

CREATE INDEX idx_ambulance_queue_hospital ON ambulance_queue_log(hospital_id);
CREATE INDEX idx_ambulance_queue_created ON ambulance_queue_log(created_at);

CREATE INDEX idx_load_balancing_ambulance ON load_balancing_log(ambulance_id);
CREATE INDEX idx_load_balancing_created ON load_balancing_log(created_at);

CREATE INDEX idx_response_times_hospital ON response_times(hospital_id);
CREATE INDEX idx_response_times_call ON response_times(call_time);

CREATE INDEX idx_positioning_ambulance ON ambulance_positioning_log(ambulance_id);
CREATE INDEX idx_positioning_created ON ambulance_positioning_log(created_at);

-- Views for analytics
CREATE OR REPLACE VIEW hospital_load_distribution AS
SELECT 
  h.id,
  h.name,
  h.level,
  COUNT(ra.id) as total_recommendations,
  COUNT(CASE WHEN ra.override = TRUE THEN 1 END) as override_count,
  ROUND(COUNT(CASE WHEN ra.override = TRUE THEN 1 END) * 100.0 / 
        NULLIF(COUNT(ra.id), 0), 2) as override_rate,
  AVG(ra.recommended_score) as avg_recommendation_score
FROM hospitals h
LEFT JOIN routing_analytics ra ON h.id = ra.recommended_hospital
WHERE ra.created_at > NOW() - INTERVAL '7 days'
GROUP BY h.id, h.name, h.level;

CREATE OR REPLACE VIEW response_time_by_hospital AS
SELECT 
  h.id,
  h.name,
  COUNT(rt.id) as total_calls,
  AVG(rt.response_minutes) as avg_response_time,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY rt.response_minutes) as median_response,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rt.response_minutes) as p95_response,
  MIN(rt.response_minutes) as min_response,
  MAX(rt.response_minutes) as max_response
FROM hospitals h
LEFT JOIN response_times rt ON h.id = rt.hospital_id
WHERE rt.created_at > NOW() - INTERVAL '7 days'
GROUP BY h.id, h.name;

CREATE OR REPLACE VIEW override_analysis AS
SELECT 
  ro.override_reason,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM routing_overrides), 2) as percentage
FROM routing_overrides ro
WHERE ro.created_at > NOW() - INTERVAL '7 days'
GROUP BY ro.override_reason
ORDER BY count DESC;
