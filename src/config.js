/**
 * Configuration for 5G Emergency Response Network
 */

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    wsPort: process.env.WS_PORT || 3001,
    environment: process.env.NODE_ENV || 'development'
  },

  network: {
    // 5G URLLC (Ultra-Reliable Low-Latency Communication)
    latency5G: {
      min: 5,
      max: 10,
      average: 8
    },
    // 4G LTE comparison
    latency4G: {
      min: 30,
      max: 100,
      average: 60
    },
    // 5G bandwidth
    bandwidth5G: 1000, // Mbps
    bandwidth4G: 50, // Mbps
    // Network slicing
    slicing: {
      emergencySlice: 0.3, // 30% of network dedicated to emergency
      iotSlice: 0.2, // 20% for IoT sensors
      generalSlice: 0.5 // 50% for general traffic
    }
  },

  // Ankara City Geographic Bounds
  ankara: {
    center: {
      lat: 39.9334,
      lng: 32.8597
    },
    bounds: {
      north: 40.2,
      south: 39.7,
      east: 33.2,
      west: 32.5
    },
    // Major districts (ilçeler)
    districts: [
      { name: 'Keçiören', lat: 40.1, lng: 32.9, population: 632000 },
      { name: 'Çankaya', lat: 39.85, lng: 32.85, population: 574000 },
      { name: 'Mamak', lat: 40.0, lng: 32.7, population: 405000 },
      { name: 'Altındağ', lat: 39.95, lng: 32.85, population: 288000 },
      { name: 'Yenimahalle', lat: 40.0, lng: 32.8, population: 406000 },
      { name: 'Pursaklar', lat: 40.15, lng: 32.65, population: 132000 },
      { name: 'Kahramankazan', lat: 40.28, lng: 32.75, population: 65000 },
      { name: 'Akyurt', lat: 40.1, lng: 33.1, population: 138000 }
    ]
  },

  // Hospital data for Ankara
  hospitals: [
    {
      id: 'hosp_ankara_1',
      name: 'Ankara Numune Hastanesi',
      district: 'Altındağ',
      lat: 39.9452,
      lng: 32.8676,
      beds: 1200,
      erBeds: 45,
      specialties: ['Trauma', 'Cardiology', 'Neurology'],
      status: 'OPERATIONAL'
    },
    {
      id: 'hosp_ankara_2',
      name: 'Hacettepe Üniversitesi Hastanesi',
      district: 'Altındağ',
      lat: 39.9598,
      lng: 32.8784,
      beds: 1500,
      erBeds: 50,
      specialties: ['Trauma', 'Burn Center', 'Pediatric Emergency'],
      status: 'OPERATIONAL'
    },
    {
      id: 'hosp_ankara_3',
      name: 'Ankara Atatürk Eğitim ve Araştırma Hastanesi',
      district: 'Çankaya',
      lat: 39.8476,
      lng: 32.8342,
      beds: 650,
      erBeds: 30,
      specialties: ['General Surgery', 'Orthopedics'],
      status: 'OPERATIONAL'
    },
    {
      id: 'hosp_ankara_4',
      name: 'Bayındır Hastanesi',
      district: 'Çankaya',
      lat: 39.8392,
      lng: 32.8512,
      beds: 200,
      erBeds: 15,
      specialties: ['Cardiology', 'Internal Medicine'],
      status: 'OPERATIONAL'
    },
    {
      id: 'hosp_ankara_5',
      name: 'American Hospital',
      district: 'Yenimahalle',
      lat: 40.0152,
      lng: 32.8156,
      beds: 150,
      erBeds: 12,
      specialties: ['Trauma', 'General Surgery'],
      status: 'OPERATIONAL'
    }
  ],

  // Ambulance stations in Ankara
  ambulanceStations: [
    {
      id: 'station_kecieren',
      name: 'Keçiören Ambulance Station',
      district: 'Keçiören',
      lat: 40.1,
      lng: 32.9,
      ambulances: 12,
      coverage: 'North Ankara'
    },
    {
      id: 'station_cankaya',
      name: 'Çankaya Ambulance Station',
      district: 'Çankaya',
      lat: 39.85,
      lng: 32.85,
      ambulances: 15,
      coverage: 'South Ankara'
    },
    {
      id: 'station_mamak',
      name: 'Mamak Ambulance Station',
      district: 'Mamak',
      lat: 40.0,
      lng: 32.7,
      ambulances: 10,
      coverage: 'West Ankara'
    },
    {
      id: 'station_central',
      name: 'Central Emergency Station',
      district: 'Altındağ',
      lat: 39.95,
      lng: 32.85,
      ambulances: 20,
      coverage: 'Central Ankara'
    }
  ],

  // Major streets/landmarks in Ankara for realistic routing
  landmarks: [
    { name: 'Kızılay Square', lat: 39.9381, lng: 32.8687, type: 'hub' },
    { name: 'Ulus Bazaar', lat: 39.9648, lng: 32.8627, type: 'landmark' },
    { name: 'Ataturk Mausoleum', lat: 39.9280, lng: 32.8394, type: 'landmark' },
    { name: 'Ankara Castle', lat: 39.9677, lng: 32.8644, type: 'landmark' },
    { name: 'Cebeci Medical Complex', lat: 39.9598, lng: 32.8784, type: 'hospital' },
    { name: 'TED Ankara University', lat: 40.1234, lng: 32.8432, type: 'education' }
  ],

  // Vital signs thresholds
  vitals: {
    heartRate: { min: 40, max: 160, critical_min: 40, critical_max: 150 },
    bloodPressure: { systolic_critical: 180, diastolic_critical: 120 },
    spO2: { critical: 85 },
    temperature: { critical_high: 40, critical_low: 35 },
    respiratoryRate: { min: 8, max: 50, critical_min: 8, critical_max: 40 }
  },

  // Response time baselines (in seconds)
  responseTime: {
    central_to_kizilai: 8,
    central_to_district_edge: 20,
    hospital_to_farthest_district: 25,
    average_er_response: 45 // ER prep time after notification
  },

  // AI Triage levels
  triageLevels: {
    CRITICAL: {
      priority: 1,
      erActivation: true,
      resourceAllocation: 1.0,
      maxWaitTime: 5
    },
    URGENT: {
      priority: 2,
      erActivation: true,
      resourceAllocation: 0.7,
      maxWaitTime: 15
    },
    STABLE: {
      priority: 3,
      erActivation: false,
      resourceAllocation: 0.3,
      maxWaitTime: 60
    }
  }
};

