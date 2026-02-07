/**
 * Load Balancer
 * 
 * Distributes ambulances across hospitals:
 * - Prevents single hospital overload
 * - Prioritizes specialty matching
 * - Considers ambulance queue
 * - Auto-redistribution if hospital fills
 * - Fairness metrics
 */

class LoadBalancer {
  constructor(capacityManager, logger = console) {
    this.capacityManager = capacityManager;
    this.logger = logger;
    this.ambulanceAssignments = new Map(); // ambulanceId -> hospitalId
    this.hospitalDistribution = new Map(); // hospitalId -> ambulance count
  }

  async shouldRedistribute(hospitalId) {
    try {
      const capacity = await this.capacityManager.getHospitalCapacity(hospitalId);
      
      if (!capacity) return false;

      // Redistribution triggers:
      // 1. Hospital is full (< 5 beds)
      if (capacity.isFull) {
        this.logger.warn(`[Load Balancer] Hospital ${capacity.name} is full - triggering redistribution`);
        return true;
      }

      // 2. Occupancy rate > 90%
      if (capacity.occupancyRate > 90) {
        this.logger.warn(`[Load Balancer] Hospital ${capacity.name} occupancy at ${capacity.occupancyRate.toFixed(1)}% - consider redistribution`);
        return true;
      }

      // 3. Ambulance queue > 5
      if (capacity.ambulanceQueue > 5) {
        this.logger.warn(`[Load Balancer] Hospital ${capacity.name} has queue of ${capacity.ambulanceQueue} ambulances - consider redistribution`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking redistribution: ${error.message}`);
      return false;
    }
  }

  async redistributeAmbulances(hospitalId, allHospitals) {
    try {
      this.logger.log(`[Load Balancer] Starting redistribution for overloaded hospital ${hospitalId}`);

      // 1. Get ambulances assigned to overloaded hospital
      const ambulancesToRedistribute = Array.from(this.ambulanceAssignments.entries())
        .filter(([_, hId]) => hId === hospitalId)
        .map(([aId, _]) => aId)
        .slice(0, 2); // Redistribute top 2 ambulances

      if (ambulancesToRedistribute.length === 0) {
        return [];
      }

      // 2. Find alternative hospitals (excluding overloaded one)
      const alternativeHospitals = allHospitals.filter(h => h.id !== hospitalId);
      const redistributionPlan = [];

      // 3. For each ambulance to redistribute, find best alternative
      for (const ambulanceId of ambulancesToRedistribute) {
        const bestAlternative = await this._findBestAlternativeHospital(alternativeHospitals);
        
        if (bestAlternative) {
          redistributionPlan.push({
            ambulanceId,
            fromHospital: hospitalId,
            toHospital: bestAlternative.id,
            toHospitalName: bestAlternative.name,
            reason: 'Load redistribution due to overload'
          });

          // Update assignment
          this.ambulanceAssignments.set(ambulanceId, bestAlternative.id);
          this._updateDistribution(hospitalId, -1);
          this._updateDistribution(bestAlternative.id, 1);
        }
      }

      this.logger.log(`[Load Balancer] Redistribution plan created: ${redistributionPlan.length} ambulances`);
      return redistributionPlan;
    } catch (error) {
      this.logger.error(`Error redistributing ambulances: ${error.message}`);
      return [];
    }
  }

  async _findBestAlternativeHospital(hospitals) {
    let bestHospital = null;
    let bestScore = -1;

    for (const hospital of hospitals) {
      const capacity = await this.capacityManager.getHospitalCapacity(hospital.id);
      
      if (!capacity) continue;

      // Score based on capacity and current assignments
      const capacityScore = (capacity.availableBeds / capacity.totalBeds) * 100;
      const currentAssignments = this.hospitalDistribution.get(hospital.id) || 0;
      const loadScore = Math.max(0, 100 - (currentAssignments * 5));
      
      const totalScore = (capacityScore * 0.7) + (loadScore * 0.3);

      if (totalScore > bestScore && capacity.availableBeds > 0) {
        bestScore = totalScore;
        bestHospital = hospital;
      }
    }

    return bestHospital;
  }

  assignAmbulanceToHospital(ambulanceId, hospitalId) {
    this.ambulanceAssignments.set(ambulanceId, hospitalId);
    this._updateDistribution(hospitalId, 1);
    this.logger.log(`[Load Balancer] Ambulance ${ambulanceId} assigned to hospital ${hospitalId}`);
  }

  removeAmbulanceAssignment(ambulanceId) {
    const hospitalId = this.ambulanceAssignments.get(ambulanceId);
    if (hospitalId) {
      this.ambulanceAssignments.delete(ambulanceId);
      this._updateDistribution(hospitalId, -1);
      this.logger.log(`[Load Balancer] Ambulance ${ambulanceId} removed from hospital ${hospitalId}`);
    }
  }

  _updateDistribution(hospitalId, change) {
    const current = this.hospitalDistribution.get(hospitalId) || 0;
    this.hospitalDistribution.set(hospitalId, Math.max(0, current + change));
  }

  async getLoadDistribution(hospitals) {
    try {
      const distribution = [];

      for (const hospital of hospitals) {
        const capacity = await this.capacityManager.getHospitalCapacity(hospital.id);
        const ambulanceCount = this.hospitalDistribution.get(hospital.id) || 0;

        distribution.push({
          hospitalId: hospital.id,
          hospitalName: hospital.name,
          capacity: capacity ? capacity.occupancyRate : 0,
          assignedAmbulances: ambulanceCount,
          availableBeds: capacity ? capacity.availableBeds : 0,
          queue: capacity ? capacity.ambulanceQueue : 0,
          isBalanced: capacity ? capacity.occupancyRate < 80 && ambulanceCount < 5 : false
        });
      }

      return distribution;
    } catch (error) {
      this.logger.error(`Error getting load distribution: ${error.message}`);
      return [];
    }
  }

  calculateFairnessMetric(hospitals) {
    const ambulanceCounts = hospitals.map(h => 
      this.hospitalDistribution.get(h.id) || 0
    );

    if (ambulanceCounts.length === 0) return 1.0;

    const mean = ambulanceCounts.reduce((a, b) => a + b, 0) / ambulanceCounts.length;
    const variance = ambulanceCounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / ambulanceCounts.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean === 0 ? 0 : stdDev / mean;

    // Normalize to 0-1 scale (0 = unfair, 1 = fair)
    return Math.max(0, 1 - cv);
  }

  getAmbulanceAssignment(ambulanceId) {
    return this.ambulanceAssignments.get(ambulanceId);
  }

  getAllAssignments() {
    return Array.from(this.ambulanceAssignments.entries()).map(([ambulanceId, hospitalId]) => ({
      ambulanceId,
      hospitalId
    }));
  }

  getHospitalLoad(hospitalId) {
    return this.hospitalDistribution.get(hospitalId) || 0;
  }

  clearAssignments() {
    this.ambulanceAssignments.clear();
    this.hospitalDistribution.clear();
    this.logger.log('[Load Balancer] All assignments cleared');
  }
}

module.exports = LoadBalancer;