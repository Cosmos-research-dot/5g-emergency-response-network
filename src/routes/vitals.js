/**
 * Vital Signs Routes
 * Handles vital signs updates and streaming
 */

const express = require('express');
const router = express.Router();

let ambulancesMap;
let vitalsGenerator;
let triageEngine;
let broadcastFunc;

function initializeRoutes(deps) {
  ambulancesMap = deps.ambulances;
  vitalsGenerator = deps.vitalsGenerator;
  triageEngine = deps.triageEngine;
  broadcastFunc = deps.broadcast;
}

/**
 * POST /api/vitals/:ambulanceId
 * Submit patient vitals from ambulance
 */
router.post('/:ambulanceId', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.ambulanceId);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    const { vitals } = req.body;
    
    // Validate vitals
    if (!vitals || !vitals.heartRate) {
      return res.status(400).json({ error: 'Invalid vitals data' });
    }

    ambulance.vitals = vitals;
    ambulance.lastVitalsUpdate = new Date().toISOString();

    // Perform triage assessment
    const triageAssessment = triageEngine.assess(vitals, {
      age: ambulance.patientAge,
      condition: ambulance.condition
    });

    ambulance.triageLevel = triageAssessment.triageLevel;
    ambulance.triageScore = triageAssessment.compositeScore;

    // Broadcast vitals update
    broadcastFunc({
      type: 'VITALS_UPDATE',
      ambulanceId: req.params.ambulanceId,
      vitals,
      triageAssessment,
      timestamp: ambulance.lastVitalsUpdate
    });

    res.json({
      success: true,
      ambulanceId: req.params.ambulanceId,
      vitals,
      triageAssessment,
      networkLatency: Math.round(Math.random() * 8 + 1) + 'ms'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vitals/:ambulanceId
 * Get latest vitals for ambulance
 */
router.get('/:ambulanceId', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.ambulanceId);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    res.json({
      ambulanceId: req.params.ambulanceId,
      patientName: ambulance.patientName,
      vitals: ambulance.vitals,
      triageLevel: ambulance.triageLevel,
      triageScore: ambulance.triageScore,
      lastUpdate: ambulance.lastVitalsUpdate
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vitals/:ambulanceId/trend
 * Get vitals trend (last N updates)
 */
router.get('/:ambulanceId/trend', (req, res) => {
  try {
    const ambulance = ambulancesMap.get(req.params.ambulanceId);
    
    if (!ambulance) {
      return res.status(404).json({ error: 'Ambulance not found' });
    }

    if (!ambulance.vitalsHistory) {
      ambulance.vitalsHistory = [];
    }

    res.json({
      ambulanceId: req.params.ambulanceId,
      vitalsHistory: ambulance.vitalsHistory,
      trend: ambulance.vitalsHistory.length > 1 ? 'degrading' : 'stable'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
