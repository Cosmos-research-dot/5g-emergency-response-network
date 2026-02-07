# 5G Emergency Response Network - Testing Guide

## API Testing with cURL

### 1. Dispatch Ambulance

```bash
curl -X POST http://localhost:3000/api/ambulance/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "John Smith",
    "latitude": 39.93,
    "longitude": 32.85,
    "patientAge": 65,
    "condition": "critical",
    "initialVitals": {
      "heartRate": 130,
      "bloodPressure": "160/100",
      "spO2": 88,
      "temperature": 37.5,
      "respiratoryRate": 22
    },
    "priority": "CRITICAL"
  }'
```

### 2. Get All Ambulances

```bash
curl http://localhost:3000/api/ambulance
```

### 3. Get Specific Ambulance

```bash
curl http://localhost:3000/api/ambulance/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 4. Update Ambulance Location

```bash
curl -X PUT http://localhost:3000/api/ambulance/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/location \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 39.95,
    "longitude": 32.87
  }'
```

### 5. Update Ambulance Status

```bash
curl -X PUT http://localhost:3000/api/ambulance/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/status \
  -H "Content-Type: application/json" \
  -d '{"status": "EN_ROUTE"}'
```

### 6. Submit Vitals

```bash
curl -X POST http://localhost:3000/api/vitals/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  -H "Content-Type: application/json" \
  -d '{
    "vitals": {
      "heartRate": 125,
      "bloodPressure": "155/95",
      "spO2": 89,
      "temperature": 37.3,
      "respiratoryRate": 20,
      "status": "CRITICAL"
    }
  }'
```

### 7. Triage Assessment

```bash
curl -X POST http://localhost:3000/api/triage/assess \
  -H "Content-Type: application/json" \
  -d '{
    "vitals": {
      "heartRate": 130,
      "bloodPressure": "160/100",
      "spO2": 88,
      "temperature": 37.5,
      "respiratoryRate": 22
    },
    "patientInfo": {
      "age": 65,
      "condition": "critical",
      "comorbidities": ["cardiac_disease"]
    }
  }'
```

### 8. Get Hospitals

```bash
curl http://localhost:3000/api/city/hospitals
```

### 9. Get Hospital Dispatch Console

```bash
curl http://localhost:3000/api/hospital/hosp_ankara_1/dispatch-console
```

### 10. Get Network Status

```bash
curl http://localhost:3000/api/network/status
```

### 11. Compare 4G vs 5G

```bash
curl "http://localhost:3000/api/network/comparison?distance=10"
```

### 12. Get Nearest Hospital

```bash
curl "http://localhost:3000/api/city/nearest-hospital?lat=39.93&lng=32.85"
```

### 13. Get Route

```bash
curl "http://localhost:3000/api/city/route?startLat=39.93&startLng=32.85&endLat=39.94&endLng=32.86"
```

### 14. Get System Status

```bash
curl http://localhost:3000/api/status
```

### 15. Get API Documentation

```bash
curl http://localhost:3000/api/docs
```

---

## WebSocket Testing

### Using websocat

```bash
# Install websocat
cargo install websocat

# Connect to hospital console
websocat ws://localhost:3000/ws
```

### JavaScript Client Example

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');
  
  // Request network status
  ws.send(JSON.stringify({
    type: 'REQUEST_NETWORK_STATUS'
  }));
  
  // Subscribe to network metrics
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE_NETWORK_METRICS'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

ws.onerror = (error) => {
  console.error('Error:', error);
};
```

---

## Load Testing

### Using Apache Bench (ApachBench)

```bash
# Test health endpoint
ab -n 1000 -c 100 http://localhost:3000/api/health

# Test API
ab -n 1000 -c 100 -p dispatch.json -T application/json \
  http://localhost:3000/api/ambulance/dispatch
```

### Using wrk

```bash
# Install wrk
brew install wrk  # macOS
apt-get install wrk  # Ubuntu

# Load test
wrk -t12 -c400 -d30s \
  --latency \
  http://localhost:3000/api/health
```

---

## End-to-End Test Scenario

```bash
#!/bin/bash

# 1. Dispatch ambulance (get ambulance ID from response)
AMBULANCE=$(curl -s -X POST http://localhost:3000/api/ambulance/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "patientName": "Test Patient",
    "latitude": 39.93,
    "longitude": 32.85,
    "patientAge": 45,
    "condition": "critical",
    "priority": "CRITICAL"
  }' | jq -r '.ambulanceId')

echo "Dispatched ambulance: $AMBULANCE"

# 2. Verify ambulance created
curl -s http://localhost:3000/api/ambulance/$AMBULANCE | jq .

# 3. Update location multiple times
for i in {1..5}; do
  curl -s -X PUT http://localhost:3000/api/ambulance/$AMBULANCE/location \
    -H "Content-Type: application/json" \
    -d "{\"latitude\": $((39 + i*0.01)), \"longitude\": 32.85}" | jq .
  sleep 1
done

# 4. Submit vitals
curl -s -X POST http://localhost:3000/api/vitals/$AMBULANCE \
  -H "Content-Type: application/json" \
  -d '{
    "vitals": {
      "heartRate": 130,
      "bloodPressure": "160/100",
      "spO2": 88,
      "temperature": 37.5,
      "respiratoryRate": 22
    }
  }' | jq .

# 5. Get triage assessment
curl -s http://localhost:3000/api/vitals/$AMBULANCE | jq .

# 6. Update status
curl -s -X PUT http://localhost:3000/api/ambulance/$AMBULANCE/status \
  -H "Content-Type: application/json" \
  -d '{"status": "AT_HOSPITAL"}' | jq .

# 7. Complete transport
curl -s -X DELETE http://localhost:3000/api/ambulance/$AMBULANCE | jq .

echo "Test complete"
```

Save as `test-e2e.sh` and run:

```bash
chmod +x test-e2e.sh
./test-e2e.sh
```

---

## Automated Tests

Run tests with Jest:

```bash
npm test
```

Run specific test suite:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

---

## Performance Benchmarks

Expected performance metrics on standard hardware:

- **API Response Time**: < 50ms
- **WebSocket Message Latency**: < 10ms (5G simulation)
- **Concurrent Connections**: 1000+
- **Throughput**: 10000+ requests/sec
- **Memory Usage**: ~150MB (baseline)

Test with:

```bash
npm run benchmark
```

---

## Debugging

Enable debug mode