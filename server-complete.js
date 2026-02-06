/**
 * 5G Emergency Response Network - Complete Backend Server
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

const ambulances = new Map();
const hospitalClients = new Set();

const networkMetrics = {
  latency_ms: 8,
  bandwidth_mbps: 100,
  reliability: 0.99999,
  slicing_active: false,
  congestion_level: 0.2
};

// ============================================================================
// UTILITIES
// ============================================================================

function get5GLatency() {
  const baseLatency = 8;
  const jitter = Math.random() * 4;
  return Math.max(1, baseLatency + jitter - 2);
}

function generateVitalSigns(isEmergency = false) {
  if (isEmergency) {
    return {
      heartRate: 120 + Math.random() * 40,
      bloodPressure: `${80 + Math.random() * 30}/${50 + Math.random() * 20}`,
      spO2: 85 + Math.random() * 10,
      temperature: 36.8 + Math.random() * 2,
      respiratoryRate: 20 + Math.random() * 10,
      status: 'CRITICAL'
    };
  } else {
    return {
      heartRate: 60 + Math.random() * 30,
      bloodPressure: `${110 + Math.random() * 20}/${70 + Math.random() * 15}`,
      spO2: 95 + Math.random() * 5,
      temperature: 36.8 + Math.random() * 0.5,
      respiratoryRate: 12 + Math.random() * 8,
      status: 'STABLE'
    };
  }
}

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

function broadcastToHospitals(message) {
  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
    latency_ms: get5GLatency()
  });

  hospitalClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// ============================================================================
// REST ENDPOINTS
// ============================================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    network: networkMetrics
  });
});

app.post('/api/ambulance/dispatch', (req, res) => {
  const { patientName, location, isEmergency } = req.body;

  const ambulanceId = uuidv4();
  const ambulance = {
    id: ambulanceId,
    patientName: patientName || `Patient ${Math.floor(Math.random() * 1000)}`,
    location: location || { lat: 40.7128, lng: -74.0060 },
    isEmergency: isEmergency || false,
    vitals: generateVitalSigns(isEmergency),
    status: 'EN_ROUTE',
    dispatchTime: Date.now(),
    createdAt: new Date().toISOString()
  };

  ambulances.set(ambulanceId, ambulance);

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

app.get('/api/ambulances', (req, res) => {
  const ambulancesList = Array.from(ambulances.values());
  res.json({
    count: ambulancesList.length,
    ambulances: ambulancesList,
    networkStatus: networkMetrics
  });
});

app.get('/api/ambulance/:id', (req, res) => {
  const ambulance = ambulances.get(req.params.id);
  if (!ambulance) {
    return res.status(404).json({ error: 'Ambulance not found' });
  }
  res.json({
    ...ambulance,
    triage: getTriageRecommendation(ambulance.vitals)
  });
});

// ============================================================================
// WEBSOCKET SERVER (Real-time Updates)
// ============================================================================

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Hospital client connected');
  hospitalClients.add(ws);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'INIT',
    ambulances: Array.from(ambulances.values()),
    networkMetrics: networkMetrics,
    timestamp: new Date().toISOString()
  }));

  ws.on('close', () => {
    hospitalClients.delete(ws);
    console.log('Hospital client disconnected');
  });
});

// ============================================================================
// SIMULATION: Update ambulance vitals every 2 seconds
// ============================================================================

setInterval(() => {
  ambulances.forEach((ambulance) => {
    // Update vitals
    ambulance.vitals = generateVitalSigns(ambulance.isEmergency);

    // Simulate movement (random lat/lng change)
    ambulance.location.lat += (Math.random() - 0.5) * 0.001;
    ambulance.location.lng += (Math.random() - 0.5) * 0.001;

    // Broadcast update
    const update = {
      type: 'VITALS_UPDATE',
      ambulanceId: ambulance.id,
      vitals: ambulance.vitals,
      location: ambulance.location,
      triage: getTriageRecommendation(ambulance.vitals),
      latency_ms: get5GLatency()
    };

    broadcastToHospitals(update);
  });

  // Remove ambulances that have been inactive for >5 minutes
  const now = Date.now();
  ambulances.forEach((ambulance, id) => {
    if (now - ambulance.dispatchTime > 300000) {
      ambulances.delete(id);
    }
  });
}, 2000);

// ============================================================================
// START SERVER
// ============================================================================

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   5G Emergency Response Network - Backend Server               ║
║   Status: RUNNING                                              ║
║   Port: ${PORT}                                                   ║
║   WebSocket: ws://localhost:${PORT}                              ║
║   Health Check: http://localhost:${PORT}/api/health             ║
╚════════════════════════════════════════════════════════════════╝

Network Metrics