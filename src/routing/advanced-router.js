/**
 * Advanced Router - Core routing engine for 5G Emergency Response Network
 */

const { v4: uuidv4 } = require('uuid');

class AdvancedRouter {
  constructor(hospitalCapacityManager, trafficService, logger = console) {
    this.hospitalCapacityManager = hospitalCapacityManager;
    this.trafficService = trafficService;
    this.logger = logger;
    this.routingHistory = new Map();
    
    this.weights = {
      distance: 20,
      capacity: 30,
      specialization: 25,
      queue: 15,
      severity: 10
    };

    this.conditionToSpecialty = {
      'cardiac': ['cardiology', 'tertiary'],
      'stroke': ['stroke_center', 'tertiary'],
      'trauma': ['trauma_center', 'level_1'],
      'pediatric': ['pediatric', 'tertiary'],
      'burn': ['burn_center', 'tertiary'],
      'critical': ['tertiary', 'level_1'],
      'stable': ['general', 'secondary']
    };

    this.severityLevels = {
      'critical': 3,
      'urgent': 2,
      'moderate': 1,
      'minor': 0
    };
  }

  async recommendHospital(callData, patientData, ambulanceLocation, hospitals) {
    const routeId = uuidv4();
    const startTime = Date.now();

    try {
      if (!patientData || !ambulanceLocation || !hospitals || hospitals.length === 0) {
        throw new Error('Invalid routing parameters');
      }

      const hospitalScores = await Promise.all(
        hospitals.map(async (hospital) => ({
          hospital,
          score: await this._calculateHospitalScore(
            hospital,
            patientData,
            ambulanceLocation,
            callData.timestamp
          ),
          estimatedArrival: await this._calculateETA(
            ambulanceLocation,
            hospital.location,
            callData.timestamp
          ),
          queue: await this.hospitalCapacityManager.getAmbulanceQueue(hospital.id),
          availableBeds: await this.hospitalCapacityManager.getAvailableBeds(hospital.id)
        }))
      );

      const rankedHospitals = hospitalScores.sort((a, b) => b.score - a.score);

      const recommendations = {
        routeId,
        timestamp: new Date().toISOString(),
        primary: rankedHospitals[0],
        alternatives: rankedHospitals.slice(1, 3),
        allRanked: rankedHospitals,
        patientCondition: patientData.condition,
        patientSeverity: patientData.severity,
        processingTimeMs: Date.now() - startTime
      };

      this.routingHistory.set(routeId, recommendations);
      return recommendations;
    } catch (error) {
      this.logger.error(`[Advanced Router] Error: ${error.message}`);
      throw error;
    }
  }

  async _calculateHospitalScore(hospital, patientData, ambulanceLocation, timestamp) {
    let score = 0;

    const distance = this._calculateDistance(ambulanceLocation, hospital.location);
    const maxDistance = 50;
    const distanceScore = Math.max(0, (1 - (distance / maxDistance)) * 100);
    score += (distanceScore / 100) * this.weights.distance;

    const availableBeds = hospital.total_beds - hospital.occupied_beds;
    const capacityRatio = availableBeds / hospital.total_beds;
    const capacityScore = capacityRatio * 100;
    score += (capacityScore / 100) * this.weights.capacity;

    const specialtyScore = this._calculateSpecialtyMatch(
      patientData.condition,
      hospital.specializations || []
    );
    score += specialtyScore * (this.weights.specialization / 100);

    const queue = await this.hospitalCapacityManager.getAmbulanceQueue(hospital.id);
    const maxQueueSize = 10;
    const queueScore = Math.max(0, 1 - (queue / maxQueueSize)) * 100;
    score += (queueScore / 100) * this.weights.queue;

    const severityScore = this._calculateSeverityMatch(
      patientData.severity,
      hospital.level || 'secondary'
    );
    score += severityScore * (this.weights.severity / 100);

    return Math.min(100, score);
  }

  _calculateSpecialtyMatch(condition, hospitalSpecialties = []) {
    if (!condition || !hospitalSpecialties || hospitalSpecialties.length === 0) {
      return 0.5;
    }

    const preferredSpecialties = this.conditionToSpecialty[condition] || [];
    
    if (preferredSpecialties.length === 0) {
      return 0.5;
    }

    const matches = preferredSpecialties.filter(spec =>
      hospitalSpecialties.some(hs => 
        hs.toLowerCase().includes(spec.toLowerCase()) ||
        spec.toLowerCase().includes(hs.toLowerCase())
      )
    ).length;

    return Math.min(1, matches / preferredSpecialties.length);
  }

  _calculateSeverityMatch(severity, hospitalLevel) {
    const severityRank = this.severityLevels[severity] || 1;
    const levelRank = {
      'level_1': 3,
      'tertiary': 3,
      'level_2': 2,
      'secondary': 2,
      'level_3': 1,
      'primary': 0,
      'general': 1
    };

    const rank = levelRank[hospitalLevel] || 1;
    
    if (severityRank >= 2 && rank >= 2) return 1.0;
    if (severityRank >= 1 && rank >= 1) return 0.8;
    if (severityRank === 0) return 1.0;
    return 0.5;
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

  async _calculateETA(start, end, trafficTimestamp) {
    if (this.trafficService) {
      try {
        return await this.trafficService.calculateETA(start, end, trafficTimestamp);
      } catch (error) {
        this.logger.warn(`Traffic service error, using fallback: ${error.message}`);
      }
    }

    const distance = this._calculateDistance(start, end);
    const avgSpeed = 60; // km/h
    return Math.round((distance / avgSpeed) * 60);
  }

  _findBestSpecialtyMatch(condition, hospitals) {
    const preferred = this.conditionToSpecialty[condition] || [];
    
    let best = hospitals[0];
    let bestScore = 0;

    hospitals.forEach(hospital => {
      const score = this._calculateSpecialtyMatch(condition, hospital.specializations);
      if (score > bestScore) {
        bestScore = score;
        best = hospital;
      }
    });

    return best.name;
  }

  _getScoreBreakdown(ranked) {
    return {
      hospital: ranked.hospital.name,
      totalScore: ranked.score.toFixed(2),
      distance: `${this._calculateDistance(
        { latitude: 39.92, longitude: 32.85 },
        ranked.hospital.location
      ).toFixed(1)} km`,
      availableBeds: ranked.availableBeds,
      ambulanceQueue: ranked.queue,
      estimatedArrivalMinutes: ranked.estimatedArrival
    };
  }

  logOverride(routeId, paramedicsChoice, recommendedHospital, reason) {
    this.overrideReasons.push({
      timestamp: new Date().toISOString(),
      routeId,
      paramedicsChoice,
      recommendedHospital,
      reason
    });
  }

  getRoutingHistory(routeId) {
    return this.routingHistory.get(routeId);
  }

  getAllOverrides() {
    return this.overrideReasons;
  }
}

module.exports = AdvancedRouter;