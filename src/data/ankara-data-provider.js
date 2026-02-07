/**
 * Ankara City Data Provider (MCP-compatible Data Source)
 * Provides real geographic data for Ankara, Turkey
 * Can be extended to connect to real MCP servers
 */

const config = require('../config');

class AnkaraDataProvider {
  constructor() {
    this.hospitals = config.hospitals;
    this.ambulanceStations = config.ambulanceStations;
    this.districts = config.ankara.districts;
    this.landmarks = config.landmarks;
  }

  /**
   * Get all hospitals in Ankara
   */
  getHospitals(filter = {}) {
    let hospitals = [...this.hospitals];
    
    if (filter.district) {
      hospitals = hospitals.filter(h => h.district === filter.district);
    }
    if (filter.specialty) {
      hospitals = hospitals.filter(h => h.specialties.includes(filter.specialty));
    }
    if (filter.minBeds) {
      hospitals = hospitals.filter(h => h.beds >= filter.minBeds);
    }

    return hospitals;
  }

  /**
   * Get hospital by ID
   */
  getHospital(hospitalId) {
    return this.hospitals.find(h => h.id === hospitalId);
  }

  /**
   * Get nearest hospital to given coordinates
   */
  getNearestHospital(lat, lng) {
    return this.hospitals.reduce((nearest, hospital) => {
      const distance = this.calculateDistance(lat, lng, hospital.lat, hospital.lng);
      if (!nearest.distance || distance < nearest.distance) {
        return { ...hospital, distance };
      }
      return nearest;
    }, {});
  }

  /**
   * Get ambulance stations
   */
  getAmbulanceStations(filter = {}) {
    let stations = [...this.ambulanceStations];
    
    if (filter.district) {
      stations = stations.filter(s => s.district === filter.district);
    }

    return stations;
  }

  /**
   * Get nearest ambulance station
   */
  getNearestAmbulanceStation(lat, lng) {
    return this.ambulanceStations.reduce((nearest, station) => {
      const distance = this.calculateDistance(lat, lng, station.lat, station.lng);
      if (!nearest.distance || distance < nearest.distance) {
        return { ...station, distance };
      }
      return nearest;
    }, {});
  }

  /**
   * Get district info
   */
  getDistrict(districtName) {
    return this.districts.find(d => d.name === districtName);
  }

  /**
   * Get all districts with population data
   */
  getDistricts() {
    return this.districts.map(d => ({
      ...d,
      centerPoint: { lat: d.lat, lng: d.lng }
    }));
  }

  /**
   * Get nearby landmarks from coordinates
   */
  getNearbyLandmarks(lat, lng, radiusKm = 2) {
    return this.landmarks
      .map(landmark => ({
        ...landmark,
        distance: this.calculateDistance(lat, lng, landmark.lat, landmark.lng)
      }))
      .filter(landmark => landmark.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * Returns distance in kilometers
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Estimate travel time between two points
   * Based on Ankara average speeds: 40-60 km/h in city
   */
  estimateTravelTime(lat1, lng1, lat2, lng2, networkType = '5G') {
    const distance = this.calculateDistance(lat1, lng1, lat2, lng2);
    
    // Average speed in Ankara (km/h)
    let speed = 50; // default city speed
    
    // Adjust for time of day and congestion (simplified)
    const hour = new Date().getHours();
    if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19) {
      speed = 35; // rush hour
    } else if (hour >= 22 || hour <= 6) {
      speed = 60; // night time
    }

    let travelTimeMinutes = (distance / speed) * 60;
    
    // Add network latency factor for communication
    let networkLatency = 0;
    if (networkType === '4G') {
      networkLatency = 0.5; // 4G adds ~30s overhead
    } else {
      networkLatency = 0.1; // 5G adds ~6s overhead
    }

    return {
      distance: distance.toFixed(2),
      travelTimeMinutes: travelTimeMinutes.toFixed(1),
      networkLatency: networkLatency.toFixed(1),
      totalTimeMinutes: (travelTimeMinutes + networkLatency).toFixed(1),
      networkType: networkType
    };
  }

  /**
   * Get optimal route (simplified - returns waypoints)
   */
  getOptimalRoute(startLat, startLng, endLat, endLng) {
    return {
      startPoint: { lat: startLat, lng: startLng },
      endPoint: { lat: endLat, lng: endLng },
      distance: this.calculateDistance(startLat, startLng, endLat, endLng).toFixed(2),
      waypoints: this.generateWaypoints(startLat, startLng, endLat, endLng),
      estimatedTime: this.estimateTravelTime(startLat, startLng, endLat, endLng),
      landmarks: this.getNearbyLandmarks(
        (startLat + endLat) / 2,
        (startLng + endLng) / 2,
        3
      )
    };
  }

  /**
   * Generate intermediate waypoints for a route
   */
  generateWaypoints(lat1, lng1, lat2, lng2, count = 5) {
    const waypoints = [];
    for (let i = 1; i < count; i++) {
      const factor = i / count;
      waypoints.push({
        lat: (lat1 + (lat2 - lat1) * factor).toFixed(4),
        lng: (lng1 + (lng2 - lng1) * factor).toFixed(4)
      });
    }
    return waypoints;
  }

  /**
   * Get Ankara city bounds and center
   */
  getCityBounds() {
    return {
      center: config.ankara.center,
      bounds: config.ankara.bounds,
      radius: 15 // approximate radius in km
    };
  }

  /**
   * Get hospital capacity status
   */
  getHospitalCapacityStatus() {
    return this.hospitals.map(h => ({
      id: h.id,
      name: h.name,
      totalBeds: h.beds,
      erBeds: h.erBeds,
      occupancyPercent: Math.floor(Math.random() * 85) + 15, // 15-100%
      criticalCareAvailable: Math.random() > 0.2, // 80% chance available
      lastUpdated: new Date().toISOString()
    }));
  }

  /**
   * Search hospitals by multiple criteria
   */
  searchHospitals(criteria = {}) {
    const results = this.getHospitals({
      district: criteria.district,
      specialty: criteria.specialty,
      minBeds: criteria.minBeds
    });

    // Add calculated fields
    return results.map(h => ({
      ...h,
      capacity: Math.random() > 0.3 ? 'AVAILABLE' : 'LIMITED',
      estimatedAdmissionTime: Math.floor(Math.random() * 20) + 10
    }));
  }
}

module.exports = AnkaraDataProvider;
