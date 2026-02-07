/**
 * City Data Routes (MCP-compatible)
 * Ankara geographic and infrastructure data
 */

const express = require('express');
const router = express.Router();

let ankaraData;

function initializeRoutes(deps) {
  ankaraData = deps.ankaraData;
}

/**
 * GET /api/city/hospitals
 * Get all hospitals
 */
router.get('/hospitals', (req, res) => {
  try {
    const hospitals = ankaraData.getHospitals();
    res.json({
      count: hospitals.length,
      hospitals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/districts
 * Get all districts
 */
router.get('/districts', (req, res) => {
  try {
    const districts = ankaraData.getDistricts();
    res.json({
      count: districts.length,
      districts
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/ambulance-stations
 * Get ambulance stations
 */
router.get('/ambulance-stations', (req, res) => {
  try {
    const stations = ankaraData.getAmbulanceStations();
    res.json({
      count: stations.length,
      stations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/landmarks
 * Get landmarks
 */
router.get('/landmarks', (req, res) => {
  try {
    const landmarks = ankaraData.landmarks;
    res.json({
      count: landmarks.length,
      landmarks
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/bounds
 * Get city bounds
 */
router.get('/bounds', (req, res) => {
  try {
    const bounds = ankaraData.getCityBounds();
    res.json(bounds);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/nearest-hospital
 * Get nearest hospital to coordinates
 */
router.get('/nearest-hospital', (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters required' });
    }

    const hospital = ankaraData.getNearestHospital(parseFloat(lat), parseFloat(lng));
    res.json(hospital);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/nearest-station
 * Get nearest ambulance station
 */
router.get('/nearest-station', (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters required' });
    }

    const station = ankaraData.getNearestAmbulanceStation(parseFloat(lat), parseFloat(lng));
    res.json(station);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/route
 * Get optimal route between two points
 */
router.get('/route', (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng } = req.query;
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: 'All coordinates required' });
    }

    const route = ankaraData.getOptimalRoute(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng)
    );

    res.json(route);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/travel-time
 * Estimate travel time between points
 */
router.get('/travel-time', (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng, network = '5G' } = req.query;
    
    if (!startLat || !startLng || !endLat || !endLng) {
      return res.status(400).json({ error: 'All coordinates required' });
    }

    const time = ankaraData.estimateTravelTime(
      parseFloat(startLat),
      parseFloat(startLng),
      parseFloat(endLat),
      parseFloat(endLng),
      network
    );

    res.json(time);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/city/nearby-landmarks
 * Get landmarks near coordinates
 */
router.get('/nearby-landmarks', (req, res) => {
  try {
    const { lat, lng, radius = 2 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters required' });
    }

    const landmarks = ankaraData.getNearbyLandmarks(parseFloat(lat), parseFloat(lng), parseFloat(radius));
    res.json({
      count: landmarks.length,
      landmarks
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
