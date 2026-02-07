/**
 * Ambulance Positioning
 * 
 * Predictive positioning and demand forecasting:
 * - Pre-position units based on time of day
 * - Demand forecasting
 * - Coverage optimization
 * - Station-to-station rebalancing
 * - Wait time minimization
 */

class AmbulancePositioning {
  constructor(pool, redis, logger = console) {
    this.pool = pool;
    this.redis = redis;
    this.logger = logger;
    
    // Demand patterns by hour (calls per hour in Ankara)
    this.demandPatterns = {
      0: 2,   // Midnight
      1: 1,
      2: 1,
      3: 1,
      4: 2,
      5: 3,
      6: 5,   // Morning increase
      7: 8,
      8: 10,  // Peak
      9: 9,
      10: 8,
      11: 7,
      12: 8,  // Lunch peak
      13: 9,
      14: 8,
      15: 7,
      16: 8,
      17: 10, // Evening peak
      18: 12, // Highest
      19: 10,
      20: 8,
      21: 6,
      22: 4,
      23: 3
    };

    // Accident hotspots in Ankara (major intersections, highways)
    this.hotspots = [
      { name: 'Ankara Airport Road', latitude: 39.95, longitude: 32.99, frequency: 5 },
      { name: 'Tunali Hilmi District', latitude: 39.94, longitude: 32.85, frequency: 4 },
      { name: 'Aktepe Interchange', latitude: 39.88, longitude: 33.03, frequency: 4 },
      { name: 'Esentepe District', latitude: 39.92, longitude: 32.78, frequency: 3 },
      { name: 'Cebeci Campus', latitude: 39.94, longitude: 32.73, frequency: 3 },
      { name: 'Ankara Highway', latitude: 39.85, longitude: 32.88, frequency: 3 }
    ];

    // Ambulance stations
    this.stations = [];
  }

  async initializeStations() {
    try {
      const result = await this.pool.query(
        `SELECT id, name, latitude, longitude, capacity 
         FROM ambulance_stations`
      );

      this.stations = result.rows;
      this.logger.log(`[Positioning] Initialized ${this.stations.length} ambulance stations`);
      return this.stations;
    } catch (error) {
      this.logger.error(`Error initializing stations: ${error.message}`);
      return [];
    }
  }

  /**
   * Get optimal positioning for ambulances
   */
  async getOptimalPositioning(availableAmbulances) {
    try {
      const currentHour = new Date().getHours();
      const expectedDemand = this.demandPatterns[currentHour] || 5;

      // 1. Calculate ideal distribution
      const idealDistribution = this._calculateIdealDistribution(
        availableAmbulances.length,
        expectedDemand
      );

      // 2. Generate positioning recommendations
      const recommendations = this._generatePositioningRecommendations(
        availableAmbulances,
        idealDistribution,
        currentHour
      );

      return {
        timestamp: new Date().toISOString(),
        hour: currentHour,
        expectedDemand,
        recommendations,
        coverage: this._calculateCoverageMetrics(recommendations)
      };
    } catch (error) {
      this.logger.error(`Error getting optimal positioning: ${error.message}`);
      return null;
    }
  }

  _calculateIdealDistribution(totalAmbulances, expectedDemand) {
    // Distribute ambulances based on demand and coverage
    const distribution = {};

    // More units during peak hours
    const demandMultiplier = Math.max(1, expectedDemand / 5);
    const unitsPerHotspot = Math.ceil((totalAmbulances * demandMultiplier) / this.hotspots.length);

    this.hotspots.forEach(hotspot => {
      distribution[hotspot.name] = Math.ceil(unitsPerHotspot * (hotspot.frequency / 5));
    });

    return distribution;
  }

  _generatePositioningRecommendations(ambulances, distribution, currentHour) {
    const recommendations = [];

    // Match ambulances to hotspots based on distribution
    let ambulanceIdx = 0;

    this.hotspots.forEach(hotspot => {
      const count = distribution[hotspot.name] || 1;

      for (let i = 0; i < count && ambulanceIdx < ambulances.length; i++) {
        recommendations.push({
          ambulanceId: ambulances[ambulanceIdx].id,
          ambulanceCallsign: ambulances[ambulanceIdx].call_sign,
          position: hotspot,
          reason: `High call volume area (${hotspot.frequency} expected calls/hour)`,
          priority: hotspot.frequency > 3 ? 'high' : 'normal',
          estimatedWaitTime: this._estimateWaitTime(hotspot.frequency, ambulances.length)
        });

        ambulanceIdx++;
      }
    });

    return recommendations;
  }

  _estimateWaitTime(hotspotFrequency, totalAmbulances) {
    // Rough estimation: time to reach average hotspot from current position
    const avgDistance = 3; // km in Ankara
    const avgSpeed = 50; // km/h
    const baseTime = (avgDistance / avgSpeed) * 60; // in minutes

    // Adjust for demand
    const demandFactor = hotspotFrequency / 3;
    return Math.round(baseTime * demandFactor);
  }

  _calculateCoverageMetrics(recommendations) {
    if (recommendations.length === 0) {
      return { coveragePercentage: 0, avgResponseTime: 0, hotspotsCovered: 0 };
    }

    const coveredHotspots = new Set(recommendations.map(r => r.position.name)).size;
    const avgResponseTime = Math.round(
      recommendations.reduce((sum, r) => sum + r.estimatedWaitTime, 0) / recommendations.length
    );

    return {
      coveragePercentage: (coveredHotspots / this.hotspots.length) * 100,
      avgResponseTime,
      hotspotsCovered: coveredHotspots,
      totalHotspots: this.hotspots.length
    };
  }

  /**
   * Get demand forecast for next N hours
   */
  getDemandForecast(hours = 6) {
    const currentHour = new Date().getHours();
    const forecast = [];

    for (let i = 0; i < hours; i++) {
      const forecastHour = (currentHour + i) % 24;
      forecast.push({
        hour: forecastHour,
        expectedCalls: this.demandPatterns[forecastHour],
        recommendation: this._getDemandRecommendation(this.demandPatterns[forecastHour])
      });
    }

    return forecast;
  }

  _getDemandRecommendation(expectedCalls) {
    if (expectedCalls < 2) return 'Minimal coverage needed';
    if (expectedCalls < 5) return 'Standard coverage sufficient';
    if (expectedCalls < 8) return 'Increase coverage for peak hours';
    if (expectedCalls < 11) return 'High demand - pre-position units at hotspots';
    return 'Critical demand - maximum coverage required';
  }

  /**
   * Get rebalancing recommendations
   */
  async getRebalancingRecommendations(ambulancePositions, hospitals) {
    try {
      const recommendations = [];

      // Find ambulances that are far from hospitals and demand areas
      for (const ambulance of ambulancePositions) {
        const nearestHospital = this._findNearestHospital(ambulance.location, hospitals);
        const nearestHotspot = this._findNearestHotspot(ambulance.location);

        // If ambulance is far from both hospital and demand area, recommend repositioning
        if (nearestHospital.distance > 5 || nearestHotspot.distance > 4) {
          recommendations.push({
            ambulanceId: ambulance.id,
            currentLocation: ambulance.location,
            recommendedLocation: nearestHotspot.location,
            reason: `Reposition for better coverage (nearest hotspot ${nearestHotspot.distance.toFixed(1)}km away)`,
            estimatedDistance: nearestHotspot.distance
          });
        }
      }

      return {
        timestamp: new Date().toISOString(),
        recommendations,
        summary: `${recommendations.length} ambulances recommended for repositioning`
      };
    } catch (error) {
      this.logger.error(`Error getting rebalancing recommendations: ${error.message}`);
      return { recommendations: [], summary: 'Error calculating recommendations' };
    }
  }

  _findNearestHospital(location, hospitals) {
    let nearest = null;
    let minDistance = Infinity;

    hospitals.forEach(hospital => {
      const distance = this._calculateDistance(location, hospital.location);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = hospital;
      }
    });

    return {
      hospital: nearest,
      distance: minDistance
    };
  }

  _findNearestHotspot(location) {
    let nearest = null;
    let minDistance = Infinity;

    this.hotspots.forEach(hotspot => {
      const distance = this._calculateDistance(location, {
        latitude: hotspot.latitude,
        longitude: hotspot.longitude
      });
      if (distance < minDistance) {
        minDistance = distance;
        nearest = hotspot;
      }
    });

    return {
      location: nearest,
      distance: minDistance,
      name: nearest ? nearest.name : 'unknown'
    };
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

    return R * c;
  }

  getHotspots() {
    return this.hotspots;
  }

  getStations() {
    return this.stations;
  }

  getDemandPatterns() {
    return this.demandPatterns;
  }
}

module.exports = AmbulancePositioning;