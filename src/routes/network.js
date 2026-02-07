/**
 * Network Routes
 * 5G network metrics and slicing
 */

const express = require('express');
const router = express.Router();

let networkSlicing;

function initializeRoutes(deps) {
  networkSlicing = deps.networkSlicing;
}

/**
 * GET /api/network/status
 * Get comprehensive network status
 */
router.get('/status', (req, res) => {
  try {
    const status = networkSlicing.getNetworkStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/latency
 * Get latency metrics
 */
router.get('/latency', (req, res) => {
  try {
    const { type = '5G', slice = 'emergency' } = req.query;
    const latency = networkSlicing.getLatency(type, slice);
    res.json(latency);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/bandwidth
 * Get bandwidth metrics
 */
router.get('/bandwidth', (req, res) => {
  try {
    const { slice = 'emergency' } = req.query;
    const bandwidth = networkSlicing.getBandwidth(slice);
    res.json(bandwidth);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/reliability
 * Get reliability metrics
 */
router.get('/reliability', (req, res) => {
  try {
    const { slice = 'emergency' } = req.query;
    const reliability = networkSlicing.getReliability(slice);
    res.json(reliability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/comparison
 * Compare 4G vs 5G
 */
router.get('/comparison', (req, res) => {
  try {
    const { distance = 10 } = req.query;
    const comparison = networkSlicing.compare4Gvs5G(parseInt(distance));
    res.json(comparison);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/network/e2e-latency
 * Calculate end-to-end latency
 */
router.get('/e2e-latency', (req, res) => {
  try {
    const { source = 'ambulance', destination = 'hospital', distance = 10, slice = 'emergency' } = req.query;
    const e2e = networkSlicing.calculateE2ELatency(source, destination, slice, parseInt(distance));
    res.json(e2e);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initializeRoutes };
