/**
 * Triage Routes
 * AI-based triage assessment
 */

const express = require('express');
const router = express.Router();

let triageEngine;

function initializeRoutes(deps) {
  triageEngine = deps.triageEngine;
}

/**
 * POST /api/triage/assess
 * Perform triage assessment on vitals
 */
router.post('/assess', (req, res) => {
  try {
    const { vitals, patientInfo } = req.body;

    if (!vitals || !vitals.heartRate) {
      return res.status(400).json({ error: 'Invalid vitals data' });
    }

    const assessment = triageEngine.assess(vitals, patientInfo || {});

    res.json(assessment);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/triage/comprehensive
 * Full assessment including mortality risk
 */
router.post('/comprehensive', (req, res) => {
  try {
    const { vitals, patientInfo } = req.body;

    if (!vitals || !vitals.heartRate) {
      return res.status(400).json({ error: 'Invalid vitals data' });
    }

    const assessment = triageEngine.generateAssessmentSummary(vitals, patientInfo || {});

    res.json(assessment);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/triage/thresholds
 * Get clinical thresholds
 */
router.get('/thresholds', (req, res) => {
  try {
    const config = require('../config');
    res.json(config.vitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
