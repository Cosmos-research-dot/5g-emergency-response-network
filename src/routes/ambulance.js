/**
 * Ambulance Routes
 * Handles ambulance dispatch, tracking, and status management
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// Store reference to ambulances map and other services
let ambulancesMap;
let ankaraData;
let triageEngine;
let networkSlicing;
let broadcastFunc;

// Initialize routes with dependencies
function initializeRoutes(deps) {
  ambulancesMap = deps.ambulances;
  ankaraData = deps.ankaraData;
  triageEngine = deps.triageEngine;
  networkSlicing = deps.networkSlicing;
  broadcastFunc = deps.broadcast;
}

/**
 * POST /api/ambulance/dispatch
 * Dispatch a new ambulance
 */
router.post('/dispatch', (req, res) => {
  try {
    const {
      patientName,
      latitude,
      longitude,
      patientAge,
      condition,
      initialVitals,
      priority
    } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'latitude and longitude are required'
      });
    }

    const ambulanceId = uuidv4();
    
    // Find nearest hospital
    const nearestHospital = ankaraData.getNearestHospital(latitude, longitude);
    const nearestStation = ankaraData.getNearestAmbulanceStation(latitude, longitude);

    // Create ambulance object
    const ambulance = {
      id: ambulanceId,
      status: 'DISPATCHED',
      patientName: patientName || `Patient_${Math.random().toString(36).substr(2, 9)}`,
      patientAge: patientAge || 45,
      currentLocation: { lat: latitude, lng: longitude },
      hospitalId: nearestHospital.id,
      stationId: nearestStation.id,
      dispatchTime: Date.now(),
      createdAt: new Date().toISOString(),
      vitals: initialVitals || {},
      condition: condition || 'stable',
      priority: priority || 'NORMAL',
      estimatedArrival: null,
      route: ankaraData.getOptimalRoute(
        nearestStation.lat,
        nearestStation.lng,
        nearestHospital.lat,
        nearestHospital.lng
      ),
      networkMetrics: {
        latency5G: networkSlicing.getLatency('5G', 'emergency'),
        latency4G: networkSlicing.getLatency('4G', 'general')
      }
    };

    // Activate emergency slice if critical
    if (condition === 'critical' || priority === 'CRITICAL') {
      const sliceActivation = networkSlicing.activateEmergencySlice(ambulanceId);
      ambulance.emergencySlice = sliceActivation;
    }

    ambulancesMap.set(ambulanceId, ambulance);

    // Broadcast dispatch notification
    broadcastFunc({
      type: 'AMBULANCE_DISPATCHED',
      ambulanceId,
      ambulance,
      nearestHospital,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      ambulanceId,
      ambulance,
      nearestHospital: {
        id: nearestHospital.id,
        name: nearestHospital.name,
        distance: nearestHospital.distance.toFixed(2) + ' km'
      },
      network: ambulance.networkMetrics
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ambulance/:id
 * Get specific ambulance details
 */
router.get('/:id', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    res.json(ambulance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/ambulances
 * List all active ambulances
 */
router.get('/', (req, res) => {
  try {
    const ambulances = Array.from(ambulancesMap.values());
    
    res.json({
      count: ambulances.length,
      ambulances,
      networkStatus: networkSlicing.getNetworkStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ambulance/:id/location
 * Update ambulance location (GPS tracking)
 */
router.put('/:id/location', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    const { latitude, longitude } = req.body;
    ambulance.currentLocation = { lat: latitude, lng: longitude };
    ambulance.lastLocationUpdate = new Date().toISOString();

    // Calculate distance to hospital
    const hospital = ankaraData.getHospital(ambulance.hospitalId);
    const distanceToHospital = ankaraData.calculateDistance(
      latitude, longitude,
      hospital.lat, hospital.lng
    );

    ambulance.distanceToHospital = distanceToHospital.toFixed(2);

    // Broadcast location update
    broadcastFunc({
      type: 'AMBULANCE_LOCATION_UPDATE',
      ambulanceId: req.params.id,
      location: ambulance.currentLocation,
      distanceToHospital
    });

    res.json({
      success: true,
      ambulanceId: req.params.id,
      location: ambulance.currentLocation,
      distanceToHospital: distanceToHospital.toFixed(2) + ' km'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/ambulance/:id/status
 * Update ambulance status
 */
router.put('/:id/status', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    const { status } = req.body;
    const validStatuses = ['DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_HOSPITAL', 'AVAILABLE'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    ambulance.status = status;
    ambulance.statusUpdateTime = new Date().toISOString();

    // Broadcast status change
    broadcastFunc({
      type: 'AMBULANCE_STATUS_CHANGE',
      ambulanceId: req.params.id,
      newStatus: status,
      timestamp: ambulance.statusUpdateTime
    });

    res.json({ success: true, ambulanceId: req.params.id, status });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/ambulance/:id
 * Close/complete ambulance transport
 */
router.delete('/:id', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.id);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    // Deactivate emergency slice if active
    if (ambulance.emergencySlice) {
      networkSlicing.deactivateEmergencySlice(req.params.id);
    }

    ambulance.status = 'AVAILABLE';
    ambulance.completionTime = new Date().toISOString();
    ambulance.transportDuration = Date.now() - ambulance.dispatchTime;

    broadcastFunc({
      type: 'AMBULANCE_TRANSPORT_COMPLETE',
      ambulanceId: req.params.id,
      duration: ambulance.transportDuration
    });

    res.json({ success: true, ambulanceId: req.params.id, message: 'Transport completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
