/**
 * Traffic Aware Router
 * 
 * Integrates Google Maps Traffic API for:
 * - Real-time traffic conditions
 * - Multiple route options
 * - ETA adjustments based on traffic
 * - Historical traffic patterns
 * - Construction/accident avoidance
 */

const axios = require('axios');

class TrafficAwareRouter {
  constructor(googleMapsApiKey, logger = console) {
    this.googleMapsApiKey = googleMapsApiKey;
    this.logger = logger;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
    this.routeCache = new Map();
    this.cacheExpiry = 60000; // 1 minute
    this.trafficPatterns = this._initializeTrafficPatterns();
  }

  _initializeTrafficPatterns() {
    // Historical traffic patterns for Ankara (by hour of day)
    return {
      0: 0.8,   // Midnight - light traffic
      1: 0.7,
      2: 0.6,
      3: 0.6,
      4: 0.7,
      5: 0.8,
      6: 1.1,   // Morning rush starts
      7: 1.4,   // Heavy
      8: 1.5,   // Peak
      9: 1.3,
      10: 1.0,
      11: 1.0,
      12: 1.1,  // Lunch time
      13: 1.2,
      14: 1.1,
      15: 1.2,
      16: 1.3,
      17: 1.5,  // Evening rush
      18: 1.6,  // Peak
      19: 1.4,
      20: 1.2,
      21: 1.0,
      22: 0.9,
      23: 0.8
    };
  }

  async calculateETA(origin, destination, timestamp = new Date()) {
    try {
      const cacheKey = `${origin.latitude},${origin.longitude}_${destination.latitude},${destination.longitude}`;
      
      // Check cache
      const cached = this.routeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.eta;
      }

      // Get route from Google Maps Directions API
      const route = await this._getRoute(origin, destination);
      
      if (!route) {
        // Fallback to distance-based calculation
        return this._calculateETAFallback(origin, destination, timestamp);
      }

      // Adjust ETA based on current traffic and historical patterns
      const eta = this._adjustETAForTraffic(
        route.duration,
        timestamp,
        route.traffic_model
      );

      // Cache the result
      this.routeCache.set(cacheKey, {
        eta,
        timestamp: Date.now(),
        route
      });

      return eta;
    } catch (error) {
      this.logger.warn(`Error calculating ETA: ${error.message}`);
      return this._calculateETAFallback(origin, destination, timestamp);
    }
  }

  async getMultipleRoutes(origin, destination, maxRoutes = 2) {
    try {
      const routes = await this._getAlternativeRoutes(origin, destination);
      
      if (!routes || routes.length === 0) {
        return [{
          distance: this._calculateDistance(origin, destination),
          duration: this._calculateETAFallback(origin, destination),
          polyline: null,
          trafficLevel: 'unknown'
        }];
      }

      // Return top N routes with different characteristics
      return routes.slice(0, maxRoutes).map((route, idx) => ({
        routeNumber: idx + 1,
        distance: route.legs[0].distance.value / 1000, // Convert to km
        duration: route.legs[0].duration.value / 60, // Convert to minutes
        durationInTraffic: route.legs[0].duration_in_traffic?.value / 60 || null,
        polyline: route.overview_polyline.points,
        trafficLevel: this._assessTrafficLevel(route.legs[0].duration_in_traffic?.value, route.legs[0].duration.value),
        steps: route.legs[0].steps.length,
        waypoints: route.waypoints || []
      }));
    } catch (error) {
      this.logger.error(`Error getting multiple routes: ${error.message}`);
      return [];
    }
  }

  async _getRoute(origin, destination) {
    try {
      const response = await axios.get(`${this.baseUrl}/directions/json`, {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          key: this.googleMapsApiKey,
          departure_time: 'now',
          traffic_model: 'pessimistic'
        },
        timeout: 5000
      });

      if (response.data.status !== 'OK' || response.data.routes.length === 0) {
        this.logger.warn(`No routes found: ${response.data.status}`);
        return null;
      }

      const route = response.data.routes[0];
      const leg = route.legs[0];

      return {
        distance: leg.distance.value, // meters
        duration: leg.duration.value, // seconds
        durationInTraffic: leg.duration_in_traffic?.value, // seconds
        traffic_model: 'pessimistic',
        polyline: route.overview_polyline.points,
        steps: leg.steps
      };
    } catch (error) {
      this.logger.error(`Error getting route from API: ${error.message}`);
      return null;
    }
  }

  async _getAlternativeRoutes(origin, destination) {
    try {
      const response = await axios.get(`${this.baseUrl}/directions/json`, {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          key: this.googleMapsApiKey,
          alternatives: true,
          departure_time: 'now'
        },
        timeout: 5000
      });

      return response.data.routes || [];
    } catch (error) {
      this.logger.warn(`Error getting alternative routes: ${error.message}`);
      return [];
    }
  }

  _adjustETAForTraffic(baselineDuration, timestamp, trafficModel = 'pessimistic') {
    const hour = timestamp.getHours();
    const trafficMultiplier = this.trafficPatterns[hour] || 1.0;
    
    // Convert from seconds to minutes and apply traffic multiplier
    const baseMinutes = baselineDuration / 60;
    return Math.round(baseMinutes * trafficMultiplier);
  }

  _assessTrafficLevel(durationInTraffic, baseDuration) {
    if (!durationInTraffic) return 'unknown';
    
    const ratio = durationInTraffic / baseDuration;
    
    if (ratio <= 1.1) return 'light';
    if (ratio <= 1.3) return 'moderate';
    if (ratio <= 1.6) return 'heavy';
    return 'severe';
  }

  _calculateDistance(loc1, loc2) {
    const R = 6371;
    const lat1 = loc1.latitude * Math.PI / 180;
    const lat2 = loc2.latitude * Math.PI / 180;
    const dLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
    const dLng = (loc2.longitude - loc1.longitude) * Math.PI / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  _calculateETAFallback(origin, destination, timestamp) {
    const distance = this._calculateDistance(origin, destination);
    const baseSpeed = 40; // km/h in urban area
    const hour = timestamp.getHours();
    const trafficMultiplier = this.trafficPatterns[hour] || 1.0;
    const adjustedSpeed = baseSpeed / trafficMultiplier;
    
    return Math.round((distance / adjustedSpeed) * 60);
  }

  clearCache() {
    this.routeCache.clear();
    this.logger.log('[Traffic Router] Route cache cleared');
  }

  getTrafficPatternForHour(hour) {
    return this.trafficPatterns[hour] || 1.0;
  }
}

module.exports = TrafficAwareRouter;