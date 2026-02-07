/**
 * Unit Tests for Advanced Routing System
 */

const AdvancedRouter = require('../../src/routing/advanced-router');
const HospitalCapacityManager = require('../../src/routing/hospital-capacity-manager');
const LoadBalancer = require('../../src/routing/load-balancer');
const AmbulancePositioning = require('../../src/routing/ambulance-positioning');
const TrafficAwareRouter = require('../../src/routing/traffic-aware-router');

describe('AdvancedRouter', () => {
  let router;
  let mockCapacityManager;
  let mockTrafficService;

  beforeEach(() => {
    mockCapacityManager = {
      getAmbulanceQueue: jest.fn().mockResolvedValue(2),
      getAvailableBeds: jest.fn().mockResolvedValue(10)
    };

    mockTrafficService = {
      calculateETA: jest.fn().mockResolvedValue(15)
    };

    router = new AdvancedRouter(mockCapacityManager, mockTrafficService);
  });

  describe('Hospital Scoring Algorithm', () => {
    it('should recommend the highest scoring hospital', async () => {
      const callData = { timestamp: new Date() };
      const patientData = {
        condition: 'cardiac',
        severity: 'critical'
      };
      const ambulanceLocation = { latitude: 39.92, longitude: 32.85 };
      const hospitals = [
        {
          id: 1,
          name: 'Ankara Cardiology Center',
          location: { latitude: 39.90, longitude: 32.83 },
          total_beds: 100,
          occupied_beds: 70,
          specializations: ['cardiology', 'tertiary'],
          level: 'tertiary'
        },
        {
          id: 2,
          name: 'General Hospital',
          location: { latitude: 39.95, longitude: 32.90 },
          total_beds: 200,
          occupied_beds: 150,
          specializations: ['general'],
          level: 'secondary'
        }
      ];

      const result = await router.recommendHospital(callData, patientData, ambulanceLocation, hospitals);

      expect(result.primary.hospital.id).toBe(1);
      expect(result.alternatives).toHaveLength(1);
      expect(result.allRanked).toHaveLength(2);
    });

    it('should calculate distance correctly using Haversine formula', () => {
      const loc1 = { latitude: 0, longitude: 0 };
      const loc2 = { latitude: 0, longitude: 1 };
      const distance = router._calculateDistance(loc1, loc2);
      
      expect(distance).toBeGreaterThan(111); // ~111 km per degree
      expect(distance).toBeLessThan(112);
    });

    it('should match patient condition to hospital specialty', () => {
      const score1 = router._calculateSpecialtyMatch('cardiac', ['cardiology', 'tertiary']);
      const score2 = router._calculateSpecialtyMatch('cardiac', ['general']);
      const score3 = router._calculateSpecialtyMatch('unknown', ['general']);

      expect(score1).toBeGreaterThan(score2);
      expect(score3).toBeCloseTo(0.5, 1);
    });

    it('should match severity to hospital level', () => {
      const criticalMatch = router._calculateSeverityMatch('critical', 'tertiary');
      const stableMatch = router._calculateSeverityMatch('stable', 'primary');
      
      expect(criticalMatch).toBeGreaterThan(stableMatch);
    });
  });

  describe('Override Logging', () => {
    it('should log paramedic overrides', () => {
      const routeId = 'test-route-123';
      router.logOverride(routeId, 'Hospital B', 'Hospital A', 'Closer to patient home');

      const overrides = router.getAllOverrides();
      expect(overrides).toHaveLength(1);
      expect(overrides[0].routeId).toBe(routeId);
      expect(overrides[0].reason).toBe('Closer to patient home');
    });
  });
});

describe('HospitalCapacityManager', () => {
  let manager;
  let mockPool;
  let mockRedis;

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    };

    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      rpush: jest.fn(),
      llen: jest.fn(),
      lrem: jest.fn()
    };

    manager = new HospitalCapacityManager(mockPool, mockRedis);
  });

  it('should track available beds', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{ available_beds: 15 }]
    });

    const beds = await manager.getAvailableBeds('hospital-1');
    expect(beds).toBe(15);
  });

  it('should manage ambulance queue', async () => {
    mockRedis.llen.mockResolvedValueOnce(3);

    const queue = await manager.getAmbulanceQueue('hospital-1');
    expect(queue).toBe(3);
  });

  it('should detect overloaded hospitals', async () => {
    mockPool.query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        name: 'Hospital',
        total_beds: 100,
        occupied_beds: 95,
        specializations: [],
        level: 'secondary',
        latitude: 39.92,
        longitude: 32.85
      }]
    });

    mockRedis.llen.mockResolvedValueOnce(0);

    const capacity = await manager.getHospitalCapacity(1);
    expect(capacity.isOverloaded).toBe(true);
  });
});

describe('LoadBalancer', () => {
  let balancer;
  let mockCapacityManager;

  beforeEach(() => {
    mockCapacityManager = {
      getHospitalCapacity: jest.fn(),
      getAmbulanceQueue: jest.fn()
    };

    balancer = new LoadBalancer(mockCapacityManager);
  });

  it('should assign ambulances to hospitals', () => {
    balancer.assignAmbulanceToHospital('ambulance-1', 'hospital-1');

    const assignment = balancer.getAmbulanceAssignment('ambulance-1');
    expect(assignment).toBe('hospital-1');
  });

  it('should calculate fairness metrics', () => {
    const hospitals = [
      { id: 1 },
      { id: 2 },
      { id: 3 }
    ];

    balancer.assignAmbulanceToHospital('a1', 1);
    balancer.assignAmbulanceToHospital('a2', 1);
    balancer.assignAmbulanceToHospital('a3', 2);

    const fairness = balancer.calculateFairnessMetric(hospitals);
    expect(fairness).toBeGreaterThanOrEqual(0);
    expect(fairness).toBeLessThanOrEqual(1);
  });

  it('should trigger redistribution for overloaded hospitals', async () => {
    mockCapacityManager.getHospitalCapacity.mockResolvedValueOnce({
      id: 1,
      name: 'Hospital 1',
      availableBeds: 2,
      isFull: true,
      ambulanceQueue: 0
    });

    const shouldRedistribute = await balancer.shouldRedistribute(1);
    expect(shouldRedistribute).toBe(true);
  });
});

describe('AmbulancePositioning', () => {
  let positioning;
  let mockPool;
  let mockRedis;

  beforeEach(() => {
    mockPool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { id: 1, name: 'Station 1', latitude: 39.92, longitude: 32.85, capacity: 5 }
        ]
      })
    };

    mockRedis = {};

    positioning = new AmbulancePositioning(mockPool, mockRedis);
  });

  it('should generate demand forecast', () => {
    const forecast = positioning.getDemandForecast(6);

    expect(forecast).toHaveLength(6);
    forecast.forEach(item => {
      expect(item.hour).toBeGreaterThanOrEqual(0);
      expect(item.hour).toBeGreaterThanOrEqual(0);
      expect(item.expectedCalls).toBeGreaterThanOrEqual(0);
    });
  });

  it('should identify demand hotspots', () => {
    const hotspots = positioning.getHotspots();
    
    expect(hotspots.length).toBeGreaterThan(0);
    hotspots.forEach(hotspot => {
      expect(hotspot.latitude).toBeGreaterThanOrEqual(39.5);
      expect(hotspot.latitude).toBeLessThanOrEqual(40.5);
      expect(hotspot.longitude).toBeGreaterThanOrEqual(32);
      expect(hotspot.longitude).toBeLessThanOrEqual(33.5);
    });
  });

  it('should calculate optimal positioning', async () => {
    const ambulances = [
      { id: 1, call_sign: 'Ambulance-1', status: 'available' },
      { id: 2, call_sign: 'Ambulance-2', status: 'available' },
      { id: 3, call_sign: 'Ambulance-3', status: 'idle' }
    ];

    const positioning_result = await positioning.getOptimalPositioning(ambulances);

    expect(positioning_result.recommendations).toBeDefined();
    expect(positioning_result.coverage).toBeDefined();
    expect(positioning_result.coverage.avgResponseTime).toBeGreaterThan(0);
  });
});

describe('TrafficAwareRouter', () => {
  let trafficRouter;

  beforeEach(() => {
    trafficRouter = new TrafficAwareRouter('dummy-api-key');
  });

  it('should apply traffic multipliers by hour', () => {
    // Rush hour
    const morningRush = trafficRouter.getTrafficPatternForHour(8);
    expect(morningRush).toBeGreaterThan(1.2);

    // Late night
    const lateNight = trafficRouter.getTrafficPatternForHour(3);
    expect(lateNight).toBeLessThan(1.0);
  });

  it('should calculate distance between coordinates', () => {
    const origin = { latitude: 39.92, longitude: 32.85 };
    const destination = { latitude: 39.95, longitude: 32.90 };

    const distance = trafficRouter._calculateDistance(origin, destination);
    
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(20);
  });

  it('should calculate ETA with fallback', () => {
    const origin = { latitude: 39.92, longitude: 32.85 };
    const destination = { latitude: 39.95, longitude: 32.90 };
    const now = new Date();

    const eta = trafficRouter._calculateETAFallback(origin, destination, now);

    expect(eta).toBeGreaterThan(0);
    expect(typeof eta).toBe('number');
  });

  it('should assess traffic levels', () => {
    const light = trafficRouter._assessTrafficLevel(120, 100); // 20% increase
    const moderate = trafficRouter._assessTrafficLevel(130, 100); // 30% increase
    const heavy = trafficRouter._assessTrafficLevel(160, 100); // 60% increase

    expect(light).toBe('light');
    expect(moderate).toBe('moderate');
    expect(heavy).toBe('heavy');
  });
});

describe('Routing Integration', () => {
  it('should handle complete routing scenario', async () => {
    const mockCapacityManager = {
      getAmbulanceQueue: jest.fn().mockResolvedValue(1),
      getAvailableBeds: jest.fn().mockResolvedValue(20),
      getHospitalCapacity: jest.fn()
    };

    const mockTrafficService = {
      calculateETA: jest.fn().mockResolvedValue(12)
    };

    const router = new AdvancedRouter(mockCapacityManager, mockTrafficService);

    const callData = { timestamp: new Date() };
    const patientData = { condition: 'stroke', severity: 'critical' };
    const ambulanceLocation = { latitude: 39.92, longitude: 32.85 };
    const hospitals = [
      {
        id: 1,
        name: 'Stroke Center',
        location: { latitude: 39.90, longitude: 32.83 },
        total_beds: 50,
        occupied_beds: 25,
        specializations: ['stroke_center', 'tertiary'],
        level: 'tertiary'
      },
      {
        id: 2,
        name: 'General Hospital',
        location: { latitude: 39.95, longitude: 32.90 },
        total_beds: 200,
        occupied_beds: 180,
        specializations: ['general'],
        level: 'secondary'
      }
    ];

    const result = await router.recommendHospital(callData, patientData, ambulanceLocation, hospitals);

    expect(result.routeId).toBeDefined();
    expect(result.primary).toBeDefined();
    expect(result.primary.hospital.id).toBe(1);
    expect(result.alternatives).toHaveLength(1);
  });
});
