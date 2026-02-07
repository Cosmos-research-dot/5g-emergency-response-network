# Advanced Routing System - Deployment Guide

## Quick Start

### 1. Prerequisites

```bash
# Node.js 18+
node --version

# PostgreSQL 13+
psql --version

# Redis 6+
redis-cli --version
```

### 2. Environment Configuration

Create `.env` file:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/emergency_db

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=optional_password

# Google Maps API
GOOGLE_MAPS_API_KEY=your_api_key_here

# Routing Configuration
ROUTING_ENABLED=true
TRAFFIC_AWARE_ROUTING=true
LOAD_BALANCING_ENABLED=true
ANALYTICS_ENABLED=true

# Performance
CAPACITY_CACHE_TTL=30000
ROUTE_CACHE_TTL=60000
ANALYTICS_FLUSH_INTERVAL=60000

# Logging
LOG_LEVEL=info
LOG_FILE=logs/routing.log

# Server
PORT=3000
HOST=0.0.0.0
```

### 3. Database Setup

```bash
# Create database
psql -U postgres -c "CREATE DATABASE emergency_db;"

# Run migrations
psql -U postgres -d emergency_db -f src/db/migrations/001-init-schema.sql
psql -U postgres -d emergency_db -f src/db/migrations/002-add-auth-security.sql
psql -U postgres -d emergency_db -f src/db/migrations/003-routing-analytics.sql

# Seed data
node src/db/seeds/seed-data.js
```

### 4. Install Dependencies

```bash
npm install

# Install additional routing dependencies
npm install axios uuid pg pg-pool
```

### 5. Start Services

```bash
# Start Redis
redis-server

# Start application
npm start

# Or development mode with auto-reload
npm run dev
```

## Integration with Express Server

### In server.js:

```javascript
const RoutingSystem = require('./src/routing');

// Initialize routing system
const routingSystem = new RoutingSystem(
  pool,
  redis,
  process.env.GOOGLE_MAPS_API_KEY,
  console
);

// Initialize
await routingSystem.initialize();

// Mount routing API routes
app.use(routingSystem.getRouter());

// Health check endpoint
app.get('/health/routing', async (req, res) => {
  const status = await routingSystem.getHealthStatus();
  res.json(status);
});
```

## Configuration Tuning

### Hospital Scoring Weights

Default weights (in advanced-router.js):

```javascript
this.weights = {
  distance: 20,        // Importance of proximity
  capacity: 30,        // Importance of available beds
  specialization: 25,  // Importance of specialty match
  queue: 15,          // Importance of ambulance queue
  severity: 10        // Importance of patient severity
};
```

To customize:

```javascript
router.weights = {
  distance: 15,        // Less important if traffic is severe
  capacity: 40,        // More important during peak hours
  specialization: 25,
  queue: 15,
  severity: 5
};
```

### Traffic Patterns

Modify in traffic-aware-router.js:

```javascript
this.trafficPatterns = {
  0: 0.8,    // Midnight - 20% faster
  8: 1.5,    // 8 AM - 50% slower
  18: 1.6,   // 6 PM - 60% slower (peak)
  // ... etc
};
```

### Load Balancing Thresholds

In hospital-capacity-manager.js:

```javascript
// Hospital marked FULL when:
isFull: availableBeds <= 5

// Hospital marked OVERLOADED when:
isOverloaded: occupancyRate > 0.9

// Redistribute when queue exceeds:
maxQueueSize: 10
```

## Monitoring and Metrics

### Key Endpoints

```bash
# Hospital capacity status
curl http://localhost:3000/api/hospitals/capacity

# Specific hospital details
curl http://localhost:3000/api/hospitals/{hospital_id}/capacity

# Load distribution
curl http://localhost:3000/api/load-distribution

# Ambulance positioning
curl http://localhost:3000/api/ambulance/positioning

# Demand forecast
curl http://localhost:3000/api/demand-forecast?hours=6

# Analytics
curl http://localhost:3000/api/analytics/hospital-utilization
curl http://localhost:3000/api/analytics/response-time
curl http://localhost:3000/api/analytics/load-distribution
curl http://localhost:3000/api/analytics/overrides
curl http://localhost:3000/api/analytics/efficiency
```

### Metrics Dashboard

Create dashboard query:

```sql
-- Real-time hospital status
SELECT h.name, h.level,
       (h.total_beds - h.occupied_beds) as available,
       ROUND((h.occupied_beds::numeric / h.total_beds) * 100, 1) as occupancy,
       COUNT(DISTINCT ra.id) as routing_count
FROM hospitals h
LEFT JOIN routing_analytics ra ON h.id = ra.recommended_hospital 
  AND ra.created_at > NOW() - INTERVAL '24 hours'
GROUP BY h.id, h.name, h.level
ORDER BY occupancy DESC;

-- Override analysis
SELECT override_reason, COUNT(*) as count
FROM routing_overrides
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY override_reason
ORDER BY count DESC;

-- Response time trends
SELECT h.name,
       AVG(rt.response_minutes) as avg_response,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY rt.response_minutes) as p95
FROM hospitals h
LEFT JOIN response_times rt ON h.id = rt.hospital_id
WHERE rt.created_at > NOW() - INTERVAL '7 days'
GROUP BY h.name
ORDER BY avg_response;
```

## Performance Optimization

### Caching Strategy

```javascript
// Redis cache keys
HOSPITAL:CAPACITY:{id}        // Hospital bed availability (TTL: 30s)
AMBULANCE:QUEUE:{hospital_id} // Ambulance queue length (TTL: 10s)
ROUTE:{origin}:{destination}  // Route cache (TTL: 60s)
TRAFFIC:PATTERN:{hour}        // Traffic pattern (TTL: 3600s)
```

### Database Query Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_hospitals_level ON hospitals(level);
CREATE INDEX idx_hospitals_occupancy ON hospitals(occupied_beds);
CREATE INDEX idx_ambulances_status ON ambulances(status);
CREATE INDEX idx_ambulances_assigned_hospital ON ambulances(assigned_hospital_id);
```

### Load Testing

```bash
# Install loadtest
npm install -g loadtest

# Load test routing recommendations (100 requests/second for 60 seconds)
loadtest -n 6000 -c 100 -p post-recommend-hospital.json http://localhost:3000/api/recommend-hospital

# Load test capacity endpoint (1000 requests/second for 10 seconds)
loadtest -n 10000 -c 1000 http://localhost:3000/api/hospitals/capacity
```

## Troubleshooting

### Issue: Slow Routing Recommendations

**Symptoms**: API responses > 500ms

**Solutions**:
1. Check database connection pool size
2. Verify Redis is running and responsive
3. Check Google Maps API rate limits
4. Monitor CPU and memory usage

```bash
# Check database connections
psql -U postgres -d emergency_db -c "SELECT count(*) FROM pg_stat_activity;"

# Check Redis
redis-cli PING

# Check application logs
tail -f logs/routing.log
```

### Issue: High Override Rate

**Symptoms**: > 20% of routing recommendations overridden

**Solutions**:
1. Review patient conditions vs recommended hospitals
2. Adjust specialty matching logic
3. Review traffic patterns
4. Train paramedics on routing recommendations

```sql
-- Analyze override patterns
SELECT override_reason, COUNT(*) as count
FROM routing_overrides
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY override_reason
ORDER BY count DESC;
```

### Issue: Hospital Overload

**Symptoms**: Single hospital receiving too many ambulances

**Solutions**:
1. Check capacity thresholds
2. Verify load balancing is enabled
3. Review distance weights
4. Check for hospital closures

```sql
-- Check hospital load distribution
SELECT h.name, COUNT(ra.id) as routing_count
FROM hospitals h
LEFT JOIN routing_analytics ra ON h.id = ra.recommended_hospital
WHERE ra.created_at > NOW() - INTERVAL '24 hours'
GROUP BY h.id, h.name
ORDER BY routing_count DESC;
```