/**
 * 5G Network Slicing Engine
 * Simulates network slicing for emergency response with latency profiles
 */

const config = require('../config');

class NetworkSlicingEngine {
  constructor() {
    this.slices = {
      emergency: {
        name: 'Emergency Services Slice',
        bandwidth: config.network.slicing.emergencySlice * 1000, // Mbps
        latency: { min: 5, max: 10 },
        reliability: 0.99999, // 99.999% (five nines)
        priority: 1,
        active: false,
        clients: new Set()
      },
      iot: {
        name: 'IoT Monitoring Slice',
        bandwidth: config.network.slicing.iotSlice * 1000,
        latency: { min: 20, max: 50 },
        reliability: 0.999, // 99.9%
        priority: 2,
        active: false,
        clients: new Set()
      },
      general: {
        name: 'General Traffic Slice',
        bandwidth: config.network.slicing.generalSlice * 1000,
        latency: { min: 50, max: 150 },
        reliability: 0.95,
        priority: 3,
        active: true,
        clients: new Set()
      }
    };

    this.networkConditions = {
      congestion: 0.2, // 0-1 scale
      timeOfDay: this.getTimeOfDay(),
      weatherImpact: 0
    };

    this.metrics = {
      totalBandwidth: 1000,
      utilizationPercent: 0,
      activeSlices: 1,
      activeConnections: 0
    };
  }

  /**
   * Activate emergency slice
   */
  activateEmergencySlice(ambulanceId) {
    this.slices.emergency.active = true;
    this.slices.emergency.clients.add(ambulanceId);

    // Reduce general slice bandwidth
    this.slices.general.bandwidth *= 0.7;
    this.slices.iot.bandwidth *= 0.85;

    return {
      status: 'ACTIVATED',
      slice: 'emergency',
      ambulanceId,
      timestamp: new Date().toISOString(),
      guarantees: {
        latency: `${this.slices.emergency.latency.max}ms max`,
        reliability: '99.999%',
        bandwidth: `${this.slices.emergency.bandwidth.toFixed(0)} Mbps`
      }
    };
  }

  /**
   * Deactivate emergency slice
   */
  deactivateEmergencySlice(ambulanceId) {
    this.slices.emergency.clients.delete(ambulanceId);

    if (this.slices.emergency.clients.size === 0) {
      this.slices.emergency.active = false;

      // Restore general and IoT slices
      this.slices.general.bandwidth = config.network.slicing.generalSlice * 1000;
      this.slices.iot.bandwidth = config.network.slicing.iotSlice * 1000;
    }

    return {
      status: 'DEACTIVATED',
      slice: 'emergency',
      ambulanceId,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get latency for a given network type and conditions
   */
  getLatency(networkType = '5G', sliceType = 'emergency') {
    let latency;

    if (networkType === '5G') {
      const slice = this.slices[sliceType];
      latency = slice.latency.min + Math.random() * (slice.latency.max - slice.latency.min);

      // Add congestion impact
      latency += this.networkConditions.congestion * 5;
    } else if (networkType === '4G') {
      const base = config.network.latency4G;
      latency = base.min + Math.random() * (base.max - base.min);

      // 4G congestion impact is higher
      latency += this.networkConditions.congestion * 30;
    } else {
      latency = 1000; // Offline
    }

    return {
      latency: Math.round(latency * 10) / 10,
      networkType,
      sliceType,
      unit: 'ms',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get bandwidth availability
   */
  getBandwidth(sliceType = 'emergency') {
    const slice = this.slices[sliceType];
    const available = slice.bandwidth * (1 - this.networkConditions.congestion);
    
    return {
      allocated: slice.bandwidth.toFixed(0),
      available: available.toFixed(0),
      utilized: (slice.bandwidth - available).toFixed(0),
      unit: 'Mbps',
      sliceType
    };
  }

  /**
   * Get reliability for slice
   */
  getReliability(sliceType = 'emergency') {
    const slice = this.slices[sliceType];
    let reliability = slice.reliability;

    // Reduce reliability based on congestion
    reliability *= (1 - this.networkConditions.congestion * 0.1);

    return {
      uptime: (reliability * 100).toFixed(3),
      downtime: ((1 - reliability) * 100).toFixed(3),
      level: this.describeReliability(reliability),
      sliceType
    };
  }

  /**
   * Describe reliability in plain text
   */
  describeReliability(reliability) {
    if (reliability >= 0.99999) return 'Five nines (99.999%)';
    if (reliability >= 0.9999) return 'Four nines (99.99%)';
    if (reliability >= 0.999) return 'Three nines (99.9%)';
    if (reliability >= 0.99) return 'Two nines (99%)';
    return 'Below 99%';
  }

  /**
   * Simulate network congestion
   */
  updateCongestion(factor = null) {
    if (factor !== null) {
      this.networkConditions.congestion = Math.min(1, Math.max(0, factor));
      return;
    }

    // Auto-update based on time of day
    const hour = new Date().getHours();
    if (hour >= 8 && hour <= 10 || hour >= 12 && hour <= 14 || hour >= 17 && hour <= 19) {
      this.networkConditions.congestion = 0.3 + Math.random() * 0.3; // 30-60%
    } else {
      this.networkConditions.congestion = 0.1 + Math.random() * 0.2; // 10-30%
    }
  }

  /**
   * Get time of day category
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 24) return 'evening';
    return 'night';
  }

  /**
   * Calculate end-to-end latency for complete communication
   */
  calculateE2ELatency(sourceType, destType, sliceType = 'emergency', distance_km = 10) {
    // Network latency
    const networkLatency = this.getLatency('5G', sliceType).latency;

    // Processing latency (varies by device)
    let processingLatency = 0;
    if (sourceType === 'sensor') processingLatency = 10; // IoT sensors
    if (sourceType === 'ambulance') processingLatency = 20; // Ambulance device
    if (sourceType === 'hospital') processingLatency = 15; // Hospital gateway

    // Propagation delay (theoretical minimum ~0.3ms per 100km)
    const propagationLatency = (distance_km / 100) * 0.3;

    const totalLatency = networkLatency + processingLatency + propagationLatency;

    return {
      networkLatency: networkLatency.toFixed(2),
      processingLatency,
      propagationLatency: propagationLatency.toFixed(2),
      totalLatency: totalLatency.toFixed(2),
      unit: 'ms',
      sliceType,
      suitable5G: totalLatency < 50,
      suitable4G: totalLatency < 100
    };
  }

  /**   * Get comprehensive network status
   */
  getNetworkStatus() {
    this.updateCongestion();
    
    return {
      timestamp: new Date().toISOString(),
      slices: {
        emergency: {
          active: this.slices.emergency.active,
          clients: this.slices.emergency.clients.size,
          bandwidth: this.getBandwidth('emergency'),
          latency: this.getLatency('5G', 'emergency'),
          reliability: this.getReliability('emergency')
        },
        iot: {
          active: this.slices.iot.active,
          clients: this.slices.iot.clients.size,
          bandwidth: this.getBandwidth('iot'),
          latency: this.getLatency('5G', 'iot'),
          reliability: this.getReliability('iot')
        },
        general: {
          active: this.slices.general.active,
          clients: this.slices.general.clients.size,
          bandwidth: this.getBandwidth('general'),
          latency: this.getLatency('5G', 'general'),
          reliability: this.getReliability('general')
        }
      },
      networkConditions: {
        congestion: (this.networkConditions.congestion * 100).toFixed(1) + '%',
        timeOfDay: this.networkConditions.timeOfDay,
        overallHealth: this.getNetworkHealth()
      }
    };
  }

  /**
   * Determine overall network health
   */
  getNetworkHealth() {
    const congestion = this.networkConditions.congestion;
    
    if (congestion > 0.8) return 'CRITICAL';
    if (congestion > 0.5) return 'DEGRADED';
    if (congestion > 0.3) return 'GOOD';
    return 'EXCELLENT';
  }

  /**
   * Compare 4G vs 5G performance
   */
  compare4Gvs5G(distanceKm = 10) {
    const latency4G = config.network.latency4G.min + 
                      Math.random() * (config.network.latency4G.max - config.network.latency4G.min) +
                      this.networkConditions.congestion * 50;
    
    const latency5G = this.getLatency('5G', 'emergency').latency;

    return {
      '4G': {
        latency: Math.round(latency4G * 10) / 10,
        bandwidth: (config.network.bandwidth4G * (1 - this.networkConditions.congestion)).toFixed(0),
        reliability: (95 - this.networkConditions.congestion * 50).toFixed(1) + '%'
      },
      '5G': {
        latency: latency5G,
        bandwidth: (config.network.bandwidth5G * (1 - this.networkConditions.congestion * 0.3)).toFixed(0),
        reliability: (99.999 - this.networkConditions.congestion * 10).toFixed(3) + '%'
      },
      improvement: {
        latencyReduction: ((latency4G - latency5G) / latency4G * 100).toFixed(1) + '%',
        bandwidthIncrease: ((config.network.bandwidth5G - config.network.bandwidth4G) / config.network.bandwidth4G * 100).toFixed(0) + '%'
      }
    };
  }
}

module.exports = NetworkSlicingEngine;
