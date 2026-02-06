/**
 * 5G Emergency Response Network - Backend Server
 * 
 * Simulates 5G URLLC (Ultra-Reliable Low-Latency Communication) for emergency response
 * Features:
 * - Real-time ambulance tracking
 * - Patient vital signs streaming
 * - Hospital-paramedic video consultation simulation
 * - Network slicing for emergency priority
 * - AI-powered triage recommendations
 */

const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================================
// DATA STRUCTURES
// ============================================================================

// Ambulances in system
const ambulances = new Map();

// Hospital ER dashboards connected
const hospitalClients = new Map();

// 5G Network metrics
const networkMetrics = {
  latency_ms: 8, // 5G URLLC typical: <10ms
  bandwidth_mbps: 100,
  reliability: 0.99999, // 99.999% uptime SLA
  slicing_active: false,
  congestion_level: 0.2 // 0-1 scale
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Simulate 5G latency (with jitter)
 */
function get5GLatency() {
  const baseLatency = 8;
  const jitter = Math.random() * 4; // ±2ms jitter
  return Math.max(1, baseLatency + jitter - 2);
}

/**
 * Generate realistic patient vital signs
 */
function generateVitalSigns(isEmergency = false) {
  if (isEmergency) {
    return {
      heartRate: 120 + Math.random() * 40, // 120-160 bpm (tachycardia)
      bloodPressure: `${80 + Math.random() * 30}/${50 + Math.random() * 20}`, // elevated
      spO2: 85 + Math.random() * 10, // 85-95% (hypoxia)
      temperature: 36.8 + Math.random() * 2, // 36.8-38.8°C
      respiratoryRate: 20 + Math.random() * 10, // 20-30 (tachypnea)
      status: 'CRITICAL'
    };
  } else {
    return {
      heartRate: 60 + Math.random() * 30, // 60-90 bpm
      bloodPressure: `${110 + Math.random() * 20}/${70 + Math.random() * 15}`, // normal
      spO2: 95 + Math.random() * 5, // 95-100%
      temperature: 36.8 + Math.random() * 0.5, // ~37°C
      respiratoryRate: 12 + Math.random() * 8, // 12-20
      status: 'STABLE'
    };
  }
}

/**
 * AI Triage Recommendation (simplified)
 */
function getTriageRecommendation(vitals) {
  const hr = parseFloat(vitals.heartRate);
  const spO2 = parseFloat(vitals.spO2);
  const rr = parseFloat(vitals.respiratoryRate);

  if (hr > 120 || spO2 < 90 || rr > 25) {
    return {
      level: 'CRITICAL',
      recommendation: 'Immediate intervention required. Activate ER trauma team.',
      actions: ['Start IV access', 'Monitor ECG continuously', 'Prepare for intubation']
    };
  } else if (hr > 100 || spO2 < 94 || rr > 20) {
    return {
      level: 'URGENT',
      recommendation: 'Urgent care needed. Notify ER immediately.',
      actions: ['Oxygen therapy', 'Monitor vitals every 5 min', 'Establish IV access']
    };
  } else {
    return {
      level: 'STABLE',
      recommendation: 'Routine transport. Standard protocols apply.',
      actions: ['Monitor vitals', 'Comfort care', 'Regular updates to hospital']
    };
  }
}

// ============================================================================
// REST ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    network: networkMetrics
  });
});

/**
 * Dispatch new ambulance
 */
app.post('/api/ambulance/dispatch', (req, res) => {
  const { patientName, location, isEmergency } = req.body;

  const ambulanceId = uuidv4();
  const ambulance = {
    id: ambulanceId,
    patientName: patientName || `Patient ${Math.floor(Math.random() * 1000)}`,
    location: location || { lat: 40.7128, lng: -74.0060 }, // NYC default
    isEmergency: isEmergency || false,
    vitals: generateVitalSigns(isEmergency),
    status: 'EN_ROUTE',
    dispatchTime: Date.now(),
    createdAt: new Date().toISOString()
  };

  ambulances.set(ambulanceId, ambulance);

  // Broadcast to all hospital dashboards
  const notification = {
    type: 'AMBULANCE_DISPATCHED',
    ambulance: ambulance,
    latency_ms: get5GLatency(),
    triageLevel: ambulance.isEmergency ? 'CRITICAL' : 'STABLE'
  };

  broadcastToHospitals(notification);

  res.json({
    success: true,
    ambulanceId: ambulanceId,
    message: `Ambulance ${ambulanceId} dispatched`,
    networkLatency: `${get5GLatency().toFixed(1)}ms (5G URLLC)`
  });
});

/**
 * Get all active ambulances
 */
app.get('/api/ambulances', (req, res) => {
  const ambulancesList = Array.from(ambulances.values());
  res.json({
    count: ambulancesList.length,
    ambulances: ambulancesList,
    networkStatus: networkMetrics
  });
});

/**
 * Get specific ambulance details
 */
app.get('/api/ambulance/:id', (req, res) => {
  const ambulance = ambulances.get(req.params.id);
  if (!ambulance) {
    return res.status(404).json({ error: 'Ambulance not found' });
  }
  res.json(ambulance);
});

/**
 * Update ambulance vitals (simulated streaming)
 */
app.put('/api/ambulance/:id/vitals', (req, res) => {
  const ambulance = ambulances.get(req.params.id);
  if (!ambulance) {