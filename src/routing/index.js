/**
 * Advanced Routing System Index
 * 
 * Exports all routing services for integration with main server
 */

const AdvancedRouter = require('./advanced-router');
const HospitalCapacityManager = require('./hospital-capacity-manager');
const TrafficAwareRouter = require('./traffic-aware-router');
const LoadBalancer = require('./load-balancer');
const AmbulancePositioning = require('./ambulance-positioning');
const RoutingAnalytics = require('./routing-analytics');
const RoutingRoutes = require('../routes/routing');

class RoutingSystem {
  constructor(pool, redis, googleMapsApiKey, logger = console) {
    this.pool = pool;
    this.redis = redis;
    this.logger = logger;

    // Initialize all services
    this.capacityManager = new HospitalCapacityManager(pool, redis, logger);
    this.trafficService = new TrafficAwareRouter(googleMapsApiKey, logger);
    this.advancedRouter = new AdvancedRouter(this.capacityManager, this.trafficService, logger);
    this.loadBalancer = new LoadBalancer(this.capacityManager, logger);
    this.positioning = new AmbulancePositioning(pool, redis, logger);
    this.analytics = new RoutingAnalytics(pool, redis, logger);
    this.routingRoutes = new RoutingRoutes(
      this.advancedRouter,
      this.capacityManager,
      this.trafficService,
      this.loadBalancer,
      this.positioning,
      this.analytics,
      pool,
      logger
    );

    this.initialized = false;
  }

  async initialize() {
    try {
      this.logger.log('[RoutingSystem] Initializing...');

      // Initialize ambulance stations
      await this.positioning.initializeStations();

      // Initialize capacity cache
      await this.capacityManager.refreshCapacityCache();

      this.initialized = true;
      this.logger.log('[RoutingSystem] Initialization complete');

      return true;
    } catch (error) {
      this.logger.error(`[RoutingSystem] Initialization error: ${error.message}`);
      return false;
    }
  }

  /**
   * Main routing recommendation function
   */
  async recommendHospital(callData, patientData, ambulanceLocation) {
    if (!this.initialized) {
      throw new Error('RoutingSystem not initialized');
    }

    try {
      // Get hospitals
      const hospitalsResult = await this.pool.query('SELECT * FROM hospitals ORDER BY name');
      const hospitals = hospitalsResult.rows;

      if (hospitals.length === 0) {
        throw new Error('No hospitals available');
      }

      // Get recommendation
      const recommendation = await this.advancedRouter.recommendHospital(
        callData,
        patientData,
        ambulanceLocation,
        hospitals
      );

      // Record in analytics
      this.analytics.recordRoutingDecision(recommendation.routeId, recommendation);

      // Check if redistribution needed
      const shouldRedistribute = await this.loadBalancer.shouldRedistribute(
        recommendation.primary.hospital.id
      );

      if (shouldRedistribute) {
        const redistribution = await this.loadBalancer.redistributeAmbulances(
          recommendation.primary.hospital.id,
          hospitals
        );
        recommendation.redistribution = redistribution;
      }

      return recommendation;
    } catch (error) {
      this.logger.error(`[RoutingSystem] Error recommending hospital: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get hospital capacity status
   */
  async getHospitalCapacity(hospitalId) {
    return this.capacityManager.getHospitalCapacity(hospitalId);
  }

  /**
   * Get all hospitals capacity
   */
  async getAllHospitalCapacities() {
    return this.capacityManager.getAllHospitalCapacities();
  }

  /**
   * Get optimal ambulance positioning
   */
  async getOptimalPositioning(ambulances) {
    return this.positioning.getOptimalPositioning(ambulances);
  }

  /**
   * Get demand forecast
   */
  getDemandForecast(hours = 6) {
    return this.positioning.getDemandForecast(hours);
  }

  /**
   * Get load distribution analysis
   */
  async getLoadDistribution() {
    return this.capacityManager.getLoadDistribution();
  }

  /**
   * Log paramedic override
   */
  logParamedicsOverride(routeId, actualHospital, reason) {
    const recommendation = this.advancedRouter.getRoutingHistory(routeId);
    const recommendedHospital = recommendation?.primary?.hospital?.name || 'unknown';

    this.advancedRouter.logOverride(routeId, actualHospital, recommendedHospital, reason);
    this.analytics.recordParamedicsOverride(routeId, actualHospital, reason);
  }

  /**
   * Get analytics reports
   */
  async getHospitalUtilizationReport() {
    return this.analytics.getHospitalUtilizationReport();
  }

  async getResponseTimeAnalysis() {
    return this.analytics.getResponseTimeAnalysis();
  }

  async getLoadDistributionAnalysis() {
    return this.analytics.getLoadDistributionAnalysis();
  }

  async getOverrideAnalysis() {
    return this.analytics.getOverrideAnalysis();
  }

  async getRouteEfficiencyMetrics() {
    return this.analytics.getRouteEfficiencyMetrics();
  }

  /**
   * Get Express router for API routes
   */
  getRouter() {
    return this.routingRoutes.getRouter();
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    try {
      const hospitals = await this.getAllHospitalCapacities();
      const overallLoad = hospitals.reduce((sum, h) => sum + h.occupancyRate, 0) / hospitals.length;

      return {
        initialized: this.initialized,
        hospitals: hospitals.length,
        overallLoad: overallLoad.toFixed(1),
        healthStatus: overallLoad > 80 ? 'CRITICAL' : overallLoad > 60 ? 'WARNING' : 'HEALTHY'
      };
    } catch (error) {
      return {
        initialized: this.initialized,
        error: error.message
      };
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    try {
      await this.capacityManager.refreshCapacityCache(); // Final flush
      this.advancedRouter.routingHistory.clear();
      this.analytics.clearSessionMetrics();
      this.loadBalancer.clearAssignments();

      this.logger.log('[RoutingSystem] Shutdown complete');
    } catch (error) {
      this.logger.error(`[RoutingSystem] Error during shutdown: ${error.message}`);
    }
  }
}

module.exports = RoutingSystem;
module.exports.AdvancedRouter = AdvancedRouter;
module.exports.HospitalCapacityManager = HospitalCapacityManager;
module.exports.TrafficAwareRouter = TrafficAwareRouter;
module.exports.LoadBalancer = LoadBalancer;
module.exports.AmbulancePositioning = AmbulancePositioning;
module.exports.RoutingAnalytics = RoutingAnalytics;
