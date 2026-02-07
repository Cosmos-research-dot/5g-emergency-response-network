/**
 * Routing API Routes
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, authorize } = require('../middleware/auth');

class RoutingRoutes {
  constructor(advancedRouter, capacityManager, trafficService, loadBalancer, positioning, analytics, pool, logger = console) {
    this.advancedRouter = advancedRouter;
    this.capacityManager = capacityManager;
    this.trafficService = trafficService;
    this.loadBalancer = loadBalancer;
    this.positioning = positioning;
    this.analytics = analytics;
    this.pool = pool;
    this.logger = logger;
    this.router = express.Router();
    this._initializeRoutes();
  }

  _initializeRoutes() {
    this.router.post('/api/recommend-hospital', authenticateToken, this._recommendHospital.bind(this));
    this.router.get('/api/recommend-hospital/:routeId', authenticateToken, this._getRecommendation.bind(this));
    this.router.get('/api/hospitals/capacity', authenticateToken, this._getHospitalCapacity.bind(this));
    this.router.get('/api/hospitals/:hospitalId/capacity', authenticateToken, this._getHospitalCapacityDetail.bind(this));
    this.router.get('/api/hospitals/queue/:hospitalId', authenticateToken, this._getAmbulanceQueue.bind(this));
    this.router.get('/api/load-distribution', authenticateToken, this._getLoadDistribution.bind(this));
    this.router.post('/api/redistribute-ambulances', authenticateToken, this._redistributeAmbulances.bind(this));
    this.router.get('/api/ambulance/positioning', authenticateToken, this._getOptimalPositioning.bind(this));
    this.router.get('/api/ambulance/rebalancing', authenticateToken, this._getRebalancingRecommendations.bind(this));
    this.router.get('/api/demand-forecast', authenticateToken, this._getDemandForecast.bind(this));
    this.router.get('/api/routes/alternatives', authenticateToken, this._getAlternativeRoutes.bind(this));
    this.router.get('/api/routes/traffic', authenticateToken, this._getTrafficInfo.bind(this));
    this.router.post('/api/routing/override', authenticateToken, this._logOverride.bind(this));
    this.router.get('/api/analytics/hospital-utilization', authenticateToken, this._getHospitalUtilization.bind(this));
    this.router.get('/api/analytics/response-time', authenticateToken, this._getResponseTimeAnalysis.bind(this));
    this.router.get('/api/analytics/load-distribution', authenticateToken, this._getLoadDistributionAnalysis.bind(this));
    this.router.get('/api/analytics/overrides', authenticateToken, this._getOverrideAnalysis.bind(this));
    this.router.get('/api/analytics/efficiency', authenticateToken, this._getRouteEfficiency.bind(this));
  }

  async _recommendHospital(req, res) {
    try {
      const { callData, patientData, ambulanceLocation } = req.body;
      if (!callData || !patientData || !ambulanceLocation) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const hospitalsResult = await this.pool.query('SELECT * FROM hospitals ORDER BY name');
      const hospitals = hospitalsResult.rows;
      if (hospitals.length === 0) {
        return res.status(404).json({ error: 'No hospitals available' });
      }

      const recommendations = await this.advancedRouter.recommendHospital(
        callData, patientData, ambulanceLocation, hospitals
      );

      this.analytics.recordRoutingDecision(recommendations.routeId, recommendations);
      if (req.user && req.user.ambulanceId) {
        this.loadBalancer.assignAmbulanceToHospital(req.user.ambulanceId, recommendations.primary.hospital.id);
      }

      res.json(recommendations);
    } catch (error) {
      this.logger.error(`[Routing API] Error recommending hospital: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async _getRecommendation(req, res) {
    try {
      const { routeId } = req.params;
      const recommendation = this.advancedRouter.getRoutingHistory(routeId);
      if (!recommendation) {
        return res.status(404).json({ error: 'Recommendation not found' });
      }
      res.json(recommendation);
    } catch (error) {
      this.logger.error(`[Routing API] Error: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  }

  async _getHospitalCapacity(req, res) {
    try {
      const capacities = await this.capacityManager.getAllHospitalCapacities();
      res.json({
        timestamp: new Date().toISOString(),
        hospitals: capacities,
        fairnessMetric: this.capacityManager._calculateFairnessMetric(capacities)
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getHospitalCapacityDetail(req, res) {
    try {
      const { hospitalId } = req.params;
      const capacity = await this.capacityManager.getHospitalCapacity(hospitalId);
      if (!capacity) {
        return res.status(404).json({ error: 'Hospital not found' });
      }
      res.json(capacity);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getAmbulanceQueue(req, res) {
    try {
      const { hospitalId } = req.params;
      const queue = await this.capacityManager.getAmbulanceQueue(hospitalId);
      const capacity = await this.capacityManager.getHospitalCapacity(hospitalId);
      res.json({
        hospitalId,
        queueLength: queue,
        isFull: capacity?.isFull || false,
        isOverloaded: capacity?.isOverloaded || false
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getLoadDistribution(req, res) {
    try {
      const distribution = await this.capacityManager.getLoadDistribution();
      res.json(distribution);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _redistributeAmbulances(req, res) {
    try {
      const { hospitalId } = req.body;
      if (!hospitalId) {
        return res.status(400).json({ error: 'Hospital ID required' });
      }

      const hospitalsResult = await this.pool.query('SELECT * FROM hospitals WHERE id != $1', [hospitalId]);
      const hospitals = hospitalsResult.rows;
      const plan = await this.loadBalancer.redistributeAmbulances(hospitalId, hospitals);

      res.json({
        success: true,
        redistributionPlan: plan,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getOptimalPositioning(req, res) {
    try {
      const ambulancesResult = await this.pool.query(
        `SELECT id, call_sign, status, latitude, longitude 
         FROM ambulances WHERE status IN ('available', 'idle')`
      );
      const positioning = await this.positioning.getOptimalPositioning(ambulancesResult.rows);
      res.json(positioning);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getRebalancingRecommendations(req, res) {
    try {
      const ambulancesResult = await this.pool.query(
        `SELECT id, call_sign, latitude, longitude FROM ambulances WHERE status IN ('available', 'idle')`
      );
      const hospitalsResult = await this.pool.query('SELECT * FROM hospitals');
      const recommendations = await this.positioning.getRebalancingRecommendations(
        ambulancesResult.rows.map(a => ({
          id: a.id,
          callSign: a.call_sign,
          location: { latitude: a.latitude, longitude: a.longitude }
        }        }),
        hospitalsResult.rows
      );
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getDemandForecast(req, res) {
    try {
      const { hours = 6 } = req.query;
      const forecast = this.positioning.getDemandForecast(parseInt(hours));
      res.json({
        forecast,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getAlternativeRoutes(req, res) {
    try {
      const { origin, destination } = req.query;
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origin and destination required' });
      }

      const [originLat, originLng] = origin.split(',').map(parseFloat);
      const [destLat, destLng] = destination.split(',').map(parseFloat);

      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }

      const routes = await this.trafficService.getMultipleRoutes(
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng }
      );

      res.json({
        routes,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getTrafficInfo(req, res) {
    try {
      const { origin, destination } = req.query;
      if (!origin || !destination) {
        return res.status(400).json({ error: 'Origin and destination required' });
      }

      const [originLat, originLng] = origin.split(',').map(parseFloat);
      const [destLat, destLng] = destination.split(',').map(parseFloat);

      const eta = await this.trafficService.calculateETA(
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng }
      );

      const trafficLevel = this.trafficService.getTrafficPatternForHour(new Date().getHours());

      res.json({
        eta,
        trafficLevel,
        currentHour: new Date().getHours(),
        trafficMultiplier: trafficLevel,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _logOverride(req, res) {
    try {
      const { routeId, paramedicsChoice, reason } = req.body;
      if (!routeId || !paramedicsChoice || !reason) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const recommendation = this.advancedRouter.getRoutingHistory(routeId);
      const recommendedHospital = recommendation?.primary?.hospital?.name || 'unknown';

      this.advancedRouter.logOverride(routeId, paramedicsChoice, recommendedHospital, reason);
      this.analytics.recordParamedicsOverride(routeId, paramedicsChoice, reason);

      res.json({
        success: true,
        routeId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getHospitalUtilization(req, res) {
    try {
      const report = await this.analytics.getHospitalUtilizationReport();
      res.json({
        report,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getResponseTimeAnalysis(req, res) {
    try {
      const analysis = await this.analytics.getResponseTimeAnalysis();
      res.json({
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getLoadDistributionAnalysis(req, res) {
    try {
      const analysis = await this.analytics.getLoadDistributionAnalysis();
      res.json({
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getOverrideAnalysis(req, res) {
    try {
      const analysis = await this.analytics.getOverrideAnalysis();
      res.json({
        analysis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async _getRouteEfficiency(req, res) {
    try {
      const metrics = await this.analytics.getRouteEfficiencyMetrics();
      res.json({
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  getRouter() {
    return this.router;
  }
}

module.exports = RoutingRoutes;
