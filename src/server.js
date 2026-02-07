/**
 * 5G Emergency Response Network - Complete Backend Server
 */

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');

const config = require('./config');
const AnkaraDataProvider = require('./data/ankara-data-provider');
const VitalSignsGenerator = require('./data/vital-signs-generator');
const TriageEngine = require('./ai/triage-engine');
const NetworkSlicingEngine = require('./network/slicing-engine');

const { router: ambulanceRouter, initializeRoutes: initAmbulanceRoutes } = require('./routes/ambulance');
const { router: vitalsRouter, initializeRoutes: initVitalsRoutes } = require('./routes/vitals');
const { router: hospitalRouter, initializeRoutes: initHospitalRoutes } = require('./routes/hospital');
const { router: triageRouter, initializeRoutes: initTriageRoutes } = require('./routes/triage');
const { router: networkRouter, initializeRoutes: initNetworkRoutes } = require('./routes/network');
const { router: cityDataRouter, initializeRoutes: initCityDataRoutes } = require('./routes/citydata');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

const PORT = config.server.port;
const HOST = config.server.host;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

const ambulancesMap = new Map();
const hospitalClientsSet = new Set();
const ankaraData = new AnkaraDataProvider();
const triageEngine = new TriageEngine();
const networkSlicing = new NetworkSlicingEngine();

function broadcastToHospitals(message) {
  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
    serverMetrics: {
      activeAmbulances: ambulancesMap.size,
      connectedHospitals: hospitalClientsSet.size,
      networkLatency: networkSlicing.getLatency('5G', 'emergency').latency
    }
  });

  hospitalClientsSet.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload); } catch(e) { }
    }
  });
}

const routeDependencies = {
  ambulances: ambulancesMap,
  ankaraData,
  triageEngine,
  networkSlicing,
  vitalsGenerator: VitalSignsGenerator,
  broadcast: broadcastToHospitals
};

initAmbulanceRoutes(routeDependencies);
initVitalsRoutes(routeDependencies);
initHospitalRoutes(routeDependencies);
initTriageRoutes(routeDependencies);
initNetworkRoutes(routeDependencies);
initCityDataRoutes(routeDependencies);

// WebSocket handlers
wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  const clientType = req.url.includes('hospital') ? 'hospital' : 'ambulance';

  console.log(`[WS] Connected: ${clientId} (${clientType})`);

  if (clientType === 'hospital') {
    hospitalClientsSet.add(ws);
  }

  ws.send(JSON.stringify({
    type: 'CONNECTION_ESTABLISHED',
    clientId,
    clientType,
    networkStatus: networkSlicing.getNetworkStatus(),
    timestamp: new Date().toISOString()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      handleWebSocketMessage(ws, message, clientId, clientType);
    } catch (error) {
      console.error(`[WS] Parse error: ${error.message}`);
    }
  });

  ws.on('close', () => {
    if (clientType === 'hospital') {
      hospitalClientsSet.delete(ws);
    }
    console.log(`[WS] Closed: ${clientId}`);
  });
});

function handleWebSocketMessage(ws, message, clientId, clientType) {
  switch (message.type) {
    case 'AMBULANCE_VITALS_STREAM':
      handleVitalsStream(ws, message, clientId);
      break;
    case 'VIDEO_CONSULTATION_REQUEST':
      handleVideoConsultation(ws, message);
      break;
    case 'LOCATION_UPDATE':
      handleLocationUpdate(message);
      break;
    case 'SUBSCRIBE_NETWORK_METRICS':
      startNetworkMetricsStream(ws);
      break;
    case 'REQUEST_NETWORK_STATUS':
      ws.send(JSON.stringify({
        type: 'NETWORK_STATUS',
        data: networkSlicing.getNetworkStatus()
      }));
      break;
  }
}

function handleVitalsStream(ws, message, clientId) {
  const { ambulanceId, interval = 1000 } = message;
  const ambulance = ambulancesMap.get(ambulanceId);

  if (!ambulance) {
    ws.send(JSON.stringify({ error: 'Ambulance not found' }));
    return;
  }

  const vitalsGenerator = new VitalSignsGenerator({
    age: ambulance.patientAge,
    condition: ambulance.condition
  });

  const streamInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(streamInterval);
      return;
    }

    const vitals = vitalsGenerator.generateVitals();
    const triageAssessment = triageEngine.assess(vitals, { age: ambulance.patientAge });

    const stream = {
      type: 'VITALS_STREAM',
      ambulanceId,
      vitals,
      triageLevel: triageAssessment.triageLevel,
      triageScore: triageAssessment.compositeScore,
      networkLatency: networkSlicing.getLatency('5G', 'emergency'),
      timestamp: new Date().toISOString()
    };

    try { ws.send(JSON.stringify(stream)); } catch(e) { }
    
    broadcastToHospitals({
      type: 'AMBULANCE_VITALS_UPDATE',
      ambulanceId,
      ...stream
    });
  }, interval);

  ws.send(JSON.stringify({
    type: 'VITALS_STREAM_STARTED',
    ambulanceId,
    interval
  }));
}

function handleVideoConsultation(ws, message) {
  const { ambulanceId, hospitalId } = message;

  broadcastToHospitals({
    type: 'VIDEO_CONSULTATION_REQUEST',
    ambulanceId,
    hospitalId,
    timestamp: new Date().toISOString(),
    networkQuality: {
      latency: networkSlicing.getLatency('5G', 'emergency').latency,
      bandwidth: networkSlicing.getBandwidth('emergency').available,
      codec: 'H.264',
      resolution: '1080p',
      frameRate: '30fps'
    }
  });

  ws.send(JSON.stringify({
    type: 'VIDEO_CONSULTATION_INITIATED',
    status: 'CONNECTING',
    estimatedLatency: networkSlicing.getLatency('5G', 'emergency').latency
  }));
}

function handleLocationUpdate(message) {
  const { ambulanceId, latitude, longitude } = message;
  const ambulance = ambulancesMap.get(ambulanceId);

  if (ambulance) {
    ambulance.currentLocation = { lat: latitude, lng: longitude };
    ambulance.lastLocationUpdate = new Date().toISOString();

    const hospital = ankaraData.getHospital(ambulance.hospitalId);
    if (hospital) {
      ambulance.distanceToHospital = ankaraData.calculateDistance(
        latitude, longitude,
        hospital.lat, hospital.lng
      );
    }

    broadcastToHospitals({
      type: 'AMBULANCE_LOCATION_UPDATE',
      ambulanceId,
      location: ambulance.currentLocation,
      distanceToHospital: ambulance.distanceToHospital
    });
  }
}

function startNetworkMetricsStream(ws) {
  const metricsInterval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(metricsInterval);
      return;
    }

    try {
      ws.send(JSON.stringify({
        type: 'NETWORK_METRICS_STREAM',
        data: networkSlicing.getNetworkStatus(),
        comparison: networkSlicing.compare4Gvs5G(),
        timestamp: new Date().toISOString()
      }));
    } catch(e) { }
  }, 2000);
}

// Routes
app.use('/api/ambulance', ambulanceRouter);
app.use('/api/vitals', vitalsRouter);
app.use('/api/hospital', hospitalRouter);
app.use('/api/triage', triageRouter);
app.use('/api/network', networkRouter);
app.use('/api/city', cityDataRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OPERATIONAL',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    activeAmbulances: ambulancesMap.size,
    connectedHospitals: hospitalClientsSet.size,
    networkStatus: networkSlicing.getNetworkStatus().networkConditions
  });
});

app.get('/api/status', (req, res) => {
  const activeAmbulances = Array.from(ambulancesMap.values());
  
  res.json({
    timestamp: new Date().toISOString(),
    system: {
      status: 'OPERATIONAL',
      uptime: process.uptime(),
      version: '1.0.0'
    },
    ambulances: {
      total: ambulancesMap.size,
      dispatched: activeAmbulances.filter(a => a.status === 'DISPATCHED').length,
      enRoute: activeAmbulances.filter(a => a.status === 'EN_ROUTE').length,
      onScene: activeAmbulances.filter(a => a.status === 'ON_SCENE').length,
      transporting: activeAmbulances.filter(a => a.status === 'TRANSPORTING').length,
      byTriageLevel: {
        CRITICAL: activeAmbulances.filter(a => a.triageLevel === 'CRITICAL').length,
        URGENT: activeAmbulances.filter(a => a.triageLevel === 'URGENT').length,
        STABLE: activeAmbulances.filter(a => a.triageLevel === 'STABLE').length
      }
    },
    hospitals: {
      total: ankaraData.getHospitals().length,
      connected: hospitalClientsSet.size
    },
    network: networkSlicing.getNetworkStatus(),
    performance: {
      avgLatency5G: networkSlicing.getLatency('5G', 'emergency').latency,
      avgLatency4G: networkSlicing.getLatency('4G', 'general').latency
    }
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend.html'));
});

app.get('/api/docs', (req, res) => {
  res.json({
    title: '5G Emergency Response Network API',
    version: '1.0.0',
    baseURL: `http://localhost:${PORT}/api`,
    endpoints: {
      ambulance: {
        dispatch: 'POST /api/ambulance/dispatch',
        list: 'GET /api/ambulance',
        get: 'GET /api/ambulance/:id',
        updateLocation: 'PUT /api/ambulance/:id/location',
        updateStatus: 'PUT /api/ambulance/:id/status'
      },
      vitals: {
        submit: 'POST /api/vitals/:ambulanceId',
        get: 'GET /api/vitals/:ambulanceId',
        trend: 'GET /api/vitals/:ambulanceId/trend'
      },
      hospital: {
        list: 'GET /api/hospital',
        get: 'GET /api/hospital/:id',
        dispatchConsole: 'GET /api/hospital/:id/dispatch-console',
        prepareBay: 'POST /api/hospital/:id/prepare-bay'
      },
      triage: {
        assess: 'POST /api/triage/assess',
        comprehensive: 'POST /api/triage/comprehensive'
      },
      network: {
        status: 'GET /api/network/status',
        latency: 'GET /api/network/latency',
        bandwidth: 'GET /api/network/bandwidth',
        comparison: 'GET /api/network/comparison'
      },
      cityData: {
        hospitals: 'GET /api/city/hospitals',
        districts: 'GET /api/city/districts',
        nearestHospital: 'GET /api/city/nearest-hospital?lat=X&lng=Y',
        route: 'GET /api/city/route?startLat=X&startLng=Y&endLat=X2&endLng=Y2'
      }
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n${'='.repeat(80)}`);
  console.log('5G EMERGENCY RESPONSE NETWORK - BACKEND SERVER');
  console.log(`${'='.repeat(80)}\n`);
  console.log(`✓ Server listening on http://${HOST}:${PORT}`);
  console.log(`✓ WebSocket endpoint: ws://${HOST}:${PORT}/ws`);
  console.log(`✓ API Documentation: http://${HOST}:${PORT}/api/docs`);
  console.log(`✓ Frontend: http://${HOST}:${PORT}/`);
  console.log(`\nCity Data Integration:`);
  console.log(`  - Hospitals: ${ankaraData.getHospitals().length}`);
  console.log(`  - Districts: ${ankaraData.getDistricts().length}`);
  console.log(`  - Ambulance Stations: ${ankaraData.getAmbulanceStations().length}`);
  console.log(`  - Landmarks: ${ankaraData.landmarks.length}`);
  console.log(`\nNetwork Configuration:`);
  console.log(`  - 5G Latency: ${config.network.latency5G.average}ms`);
  console.log(`  - 4G Latency: ${config.network.latency4G.average}ms`);
  console.log(`  - 5G Bandwidth: ${config.network.bandwidth5G} Mbps`);
  console.log(`  - 5G Reliability: 99.999% (URLLC)`);
  console.log(`\n${'-'.repeat(80)}\n`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = server;
