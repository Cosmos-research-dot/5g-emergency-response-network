/**
 * Hospital Capacity Manager
 * 
 * Real-time tracking of:
 * - Available beds by department
 * - Ambulance queue at each hospital
 * - Hospital load distribution
 * - Escalation triggers
 */

class HospitalCapacityManager {
  constructor(pool, redis, logger = console) {
    this.pool = pool;
    this.redis = redis;
    this.logger = logger;
    this.capacityCache = new Map();
    this.updateInterval = 30000; // 30 seconds
    this.cacheKeyPrefix = 'hospital:capacity:';
    this.queueKeyPrefix = 'hospital:queue:';
    
    // Start periodic updates
    this.startPeriodicUpdates();
  }

  startPeriodicUpdates() {
    setInterval(() => this.refreshCapacityCache(), this.updateInterval);
  }

  async getAvailableBeds(hospitalId) {
    try {
      // Try Redis first
      if (this.redis) {
        const cached = await this.redis.get(`${this.cacheKeyPrefix}${hospitalId}`);
        if (cached) return parseInt(cached);
      }

      // Fallback to database
      const result = await this.pool.query(
        `SELECT total_beds - occupied_beds as available_beds 
         FROM hospitals WHERE id = $1`,
        [hospitalId]
      );

      if (result.rows.length === 0) {
        this.logger.warn(`Hospital ${hospitalId} not found`);
        return 0;
      }

      const available = result.rows[0].available_beds;

      // Cache in Redis
      if (this.redis) {
        await this.redis.setex(
          `${this.cacheKeyPrefix}${hospitalId}`,
          this.updateInterval / 1000,
          available.toString()
        );
      }

      return available;
    } catch (error) {
      this.logger.error(`Error getting available beds: ${error.message}`);
      return 0;
    }
  }

  async getHospitalCapacity(hospitalId) {
    try {
      const result = await this.pool.query(
        `SELECT id, name, total_beds, occupied_beds, 
                (total_beds - occupied_beds) as available_beds,
                specializations, level, location, latitude, longitude
         FROM hospitals WHERE id = $1`,
        [hospitalId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const hospital = result.rows[0];
      
      // Get ambulance queue
      const queue = await this.getAmbulanceQueue(hospitalId);

      return {
        hospitalId,
        name: hospital.name,
        totalBeds: hospital.total_beds,
        occupiedBeds: hospital.occupied_beds,
        availableBeds: hospital.available_beds,
        occupancyRate: (hospital.occupied_beds / hospital.total_beds) * 100,
        specializations: hospital.specializations,
        level: hospital.level,
        location: {
          latitude: hospital.latitude,
          longitude: hospital.longitude
        },
        ambulanceQueue: queue,
        isFull: hospital.available_beds <= 5,
        isOverloaded: (hospital.occupied_beds / hospital.total_beds) > 0.9,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error getting hospital capacity: ${error.message}`);
      return null;
    }
  }

  async getAllHospitalCapacities() {
    try {
      const result = await this.pool.query(
        `SELECT id, name, total_beds, occupied_beds,
                (total_beds - occupied_beds) as available_beds,
                specializations, level, latitude, longitude
         FROM hospitals
         ORDER BY name`
      );

      const hospitals = await Promise.all(
        result.rows.map(async (hospital) => ({
          hospitalId: hospital.id,
          name: hospital.name,
          totalBeds: hospital.total_beds,
          occupiedBeds: hospital.occupied_beds,
          availableBeds: hospital.available_beds,
          occupancyRate: (hospital.occupied_beds / hospital.total_beds) * 100,
          specializations: hospital.specializations,
          level: hospital.level,
          location: {
            latitude: hospital.latitude,
            longitude: hospital.longitude
          },
          ambulanceQueue: await this.getAmbulanceQueue(hospital.id),
          isFull: hospital.available_beds <= 5,
          isOverloaded: (hospital.occupied_beds / hospital.total_beds) > 0.9
        }))
      );

      return hospitals;
    } catch (error) {
      this.logger.error(`Error getting all hospital capacities: ${error.message}`);
      return [];
    }
  }

  async getAmbulanceQueue(hospitalId) {
    try {
      if (this.redis) {
        const queue = await this.redis.llen(`${this.queueKeyPrefix}${hospitalId}`);
        return queue || 0;
      }

      // Fallback: query database for waiting ambulances
      const result = await this.pool.query(
        `SELECT COUNT(*) as queue_count 
         FROM ambulances 
         WHERE assigned_hospital_id = $1 
         AND status = 'en_route'`,
        [hospitalId]
      );

      return result.rows[0].queue_count || 0;
    } catch (error) {
      this.logger.error(`Error getting ambulance queue: ${error.message}`);
      return 0;
    }
  }

  async addToQueue(hospitalId, ambulanceId) {
    try {
      if (this.redis) {
        await this.redis.rpush(
          `${this.queueKeyPrefix}${hospitalId}`,
          ambulanceId
        );
      }

      this.logger.log(`[Capacity Manager] Ambulance ${ambulanceId} added to queue at hospital ${hospitalId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error adding to queue: ${error.message}`);
      return false;
    }
  }

  async removeFromQueue(hospitalId, ambulanceId) {
    try {
      if (this.redis) {
        await this.redis.lrem(
          `${this.queueKeyPrefix}${hospitalId}`,
          0,
          ambulanceId
        );
      }

      this.logger.log(`[Capacity Manager] Ambulance ${ambulanceId} removed from queue at hospital ${hospitalId}`);
      return true;
    } catch (error) {
      this.logger.error(`Error removing from queue: ${error.message}`);
      return false;
    }
  }

  async updateBedOccupancy(hospitalId, change) {
    try {
      await this.pool.query(
        `UPDATE hospitals 
         SET occupied_beds = occupied_beds + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [change, hospitalId]
      );

      // Invalidate cache
      if (this.redis) {
        await this.redis.del(`${this.cacheKeyPrefix}${hospitalId}`);
      }

      this.logger.log(`[Capacity Manager] Updated occupancy for hospital ${hospitalId} by ${change}`);
      return true;
    } catch (error) {
      this.logger.error(`Error updating bed occupancy: ${error.message}`);
      return false;
    }
  }

  async checkHospitalFull(hospitalId) {
    try {
      const available = await this.getAvailableBeds(hospitalId);
      return available <= 2; // Critical threshold
    } catch (error) {
      this.logger.error(`Error checking hospital full status: ${error.message}`);
      return false;
    }
  }

  async getLoadDistribution() {
    try {
      const hospitals = await this.getAllHospitalCapacities();
      
      const distribution = {
        hospitals: hospitals.map(h => ({
          name: h.name,
          occupancyRate: h.occupancyRate,
          availableBeds: h.availableBeds,
          queue: h.ambulanceQueue
        })),
        fairnessMetric: this._calculateFairnessMetric(hospitals),
        avgOccupancy: hospitals.reduce((sum, h) => sum + h.occupancyRate, 0) / hospitals.length,
        overloadedHospitals: hospitals.filter(h => h.isOverloaded).length,
        fullHospitals: hospitals.filter(h => h.isFull).length,
        timestamp: new Date().toISOString()
      };

      return distribution;
    } catch (error) {
      this.logger.error(`Error getting load distribution: ${error.message}`);
      return null;
    }
  }

  _calculateFairnessMetric(hospitals) {
    if (hospitals.length === 0) return 1.0;
    
    const occupancies = hospitals.map(h => h.occupancyRate);
    const mean = occupancies.reduce((a, b) => a + b, 0) / occupancies.length;
    const variance = occupancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / occupancies.length;
    const stdDev = Math.sqrt(variance);
    
    // Gini coefficient (0 = perfect fairness, 1 = perfect inequality)
    const sorted = occupancies.sort((a, b) => a - b);
    const n = sorted.length;
    let giniSum = 0;
    for (let i = 0; i < n; i++) {
      giniSum += (2 * (i + 1) - n - 1) * sorted[i];
    }
    
    const gini = (2 * giniSum) / (n * n * mean);
    return Math.max(0, 1 - gini);
  }

  async refreshCapacityCache() {
    try {
      const hospitals = await this.getAllHospitalCapacities();
      this.capacityCache.clear();
      hospitals.forEach(hospital => {
        this.capacityCache.set(hospital.hospitalId, hospital);
      });
      this.logger.log('[Capacity Manager] Cache refreshed');
    } catch (error) {
      this.logger.error(`Error refreshing cache: ${error.message}`);
    }
  }

  getCachedCapacity(hospitalId) {
    return this.capacityCache.get(hospitalId);
  }
}

module.exports = HospitalCapacityManager;