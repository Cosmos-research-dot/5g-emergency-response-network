# 5G Emergency Response Network - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    5G Emergency Response Network                │
└─────────────────────────────────────────────────────────────────┘

Patient Incident
        ↓
    911/App Call
        ↓
┌──────────────────────────────────────────────────────────────┐
│           Emergency Dispatch Center (Server)                  │
│  - Receives incident report                                   │
│  - Activates 5G network slicing for emergency               │
│  - Assigns nearest ambulance                                  │
│  - Broadcasts to all hospitals                               │
└──────────────────────────────────────────────────────────────┘
        ↓
        ├─────────────────────────────────────────┐
        ↓                                         ↓
┌──────────────────────┐              ┌──────────────────────┐
│   Ambulance (5G)     │              │  Hospital Dashboard  │
│  - Real-time vitals  │◄─ WebSocket ─►  (Multiple Doctors)  │
│  - Video stream      │  (Low latency)  - Remote diagnosis   │
│  - GPS location      │  (URLLC)        - Treatment guidance │
│  - IoT sensors       │                 - Resource prep       │
└──────────────────────┘              └──────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│         5G Network Infrastructure (Simulated)                  │
│  - URLLC: <10ms latency                                      │
│  - Network Slicing: Dedicated emergency bandwidth             │
│  - Edge Computing: Local decision making                      │
│  - Edge Station: Closest 5G base station                      │
└──────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Dispatch Server (Node.js/Express)
**Responsibilities:**
- Receive emergency calls/requests
- Manage ambulance fleet state
- Calculate optimal ambulance assignment
- Activate 5G network slicing
- Broadcast updates to hospitals via WebSocket

**Key Features:**
- RESTful API for dispatch
- WebSocket for real-time updates
- 5G latency simulation
- Network slice management
- Vital signs streaming

### 2. Ambulance Unit
**Capabilities:**
- Real-time vital sign monitoring (IoT sensors)
- Video consultation with ER doctor
- GPS location tracking
- AI-based triage
- Automatic alert system

**5G Benefits:**
- Low latency: <10ms video transmission
- URLLC: Reliable sensor data streaming
- High bandwidth: Multiple HD video streams
- Network slicing: Guaranteed priority

### 3. Hospital Dashboard (Frontend)
**Functions:**
- Monitor multiple ambulances simultaneously
- Real-time vital signs display
- Remote consultation with paramedics
- AI triage recommendations
- Prepare ER team before arrival
- Track ambulance location (map integration)

### 4. 5G Network Simulation
**Metrics:**
- Latency: 8-10ms (URLLC specification)
- Bandwidth: 100+ Mbps dedicated
- Reliability: 99.999% uptime SLA
- Network slicing: Automatic for emergencies
- Congestion handling: Priority routing

## Data Flow

### Normal Call Flow (1-2 seconds total)

```
1. Patient calls 911
   ↓
2. Dispatch receives call (100ms)
   ↓
3. Dispatch Server:
   - Creates incident record
   - Activates 5G slice
   - Finds nearest ambulance (50ms)
   ↓
4. Ambulance receives dispatch (200ms via 5G)
   ↓
5. Ambulance confirms, starts real-time vital streaming
   ↓
6. Hospital Dashboard receives:
   - Patient location
   - Vital signs (updates every 1 second)
   - AI triage recommendation (instant)
   ↓
7. ER doctor initiates video consultation (300ms)
   ↓
8. Real-time guidance begins (latency: <10ms)
```

### Latency Comparison: 4G vs 5G

```
4G Network (Current):
- Dispatch to ambulance: 500ms - 1s
- Vital signs data: 50-100ms per sample (delays in congestion)
- Video consultation: 200-500ms latency (unusable for real-time)
- Total activation time: 2-3 minutes

5G URLLC (With this system):
- Dispatch to ambulance: 150-200ms
- Vital signs data: 5-10ms per sample (real-time)
- Video consultation: <10ms latency (smooth HD video)
- Total activation time: 30-45 seconds
```

**Impact:** 100-300% faster response = 5-7% increase in survival rate per minute saved

## Network Slicing Architecture

When emergency activated:

```
5G Network Slice (Emergency)
├─ Dedicated bandwidth: 100 Mbps
├─ Latency SLA: <10ms
├─ Reliability: 99.999%
├─ Connected devices: Ambulance IoT sensors + Video stream
└─ Priority: Highest in network

Regular Network Slice (Public)
├─ Shared bandwidth: Variable
├─ Latency SLA: <50ms
├─ Reliability: 99%
└─ Priority: Lower

Management Slice
├─ Bandwidth: 10 Mbps
├─ Latency SLA: <20ms
└─ For dispatch/admin operations
```

## AI/ML Integration

### Triage Algorithm (Real-time)
```
Input: Patient vital signs (HR, BP, SpO2, RR, Temp)
   ↓
Processing:
- Rule-based initial assessment
- Anomaly detection (compare to normal ranges)
- Risk scoring (0-100)
   ↓
Output: Triage Level + Recommended Actions
- CRITICAL: HR>120, SpO2<90, RR>25
- URGENT: HR>100, SpO2<94, RR>20
- STABLE: Within normal ranges
```

### Ambulance Assignment Algorithm
```
Input: Patient location, incident type, available ambulances
   ↓
Processing:
- Calculate distance to all ambulances
- Estimate travel time (5G optimized routes)
- Check ambulance capabilities
- Predict hospital load
   ↓
Output: Best ambulance + optimal hospital
```

## Security Considerations

1. **Data Encryption:** All 5G communications encrypted (TLS 1.3)
2. **Authentication:** Ambulance/Hospital mutual TLS verification
3. **HIPAA Compliance:** Patient data encrypted at rest + in transit
4. **Network Isolation:** Dedicated emergency slice prevents tampering
5. **Audit Logging:** All events logged with timestamps

## Scalability

### Current MVP (1-10 ambulances)
- Single Node.js server
- In-memory data store
- WebSocket broadcast to <10 hospital clients

### Phase 2 (100+ ambulances)
- Load-balanced server cluster
- Redis for distributed state
- Database (MongoDB) for persistence
- Multiple WebSocket servers

### Phase 3 (1000+ ambulances, multiple cities)
- Kubernetes orchestration
- Microservices (dispatch, vitals, routing)
- Distributed 5G core simulation
- Multi-region deployment
