# 5G Emergency Response Network - API Documentation

## Base URL
```
http://localhost:3000/api
```

## WebSocket Endpoint
```
ws://localhost:3000/ws
```

---

## Authentication
Currently, no authentication required (for development). Add JWT in production.

---

## Ambulance Management

### 1. Dispatch New Ambulance
**POST** `/ambulance/dispatch`

**Request Body:**
```json
{
  "patientName": "John Doe",
  "latitude": 39.9334,
  "longitude": 32.8597,
  "patientAge": 45,
  "condition": "stable|critical",
  "initialVitals": {
    "heartRate": 75,
    "bloodPressure": "120/80",
    "spO2": 98,
    "temperature": 36.8,
    "respiratoryRate": 14
  },
  "priority": "CRITICAL|NORMAL"
}
```

**Response (201):**
```json
{
  "success": true,
  "ambulanceId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "ambulance": {
    "id": "...",
    "status": "DISPATCHED",
    "patientName": "John Doe",
    "currentLocation": {"lat": 39.9334, "lng": 32.8597},
    "hospitalId": "hosp_ankara_1",
    "condition": "stable",
    "emergencySlice": {...}
  },
  "nearestHospital": {
    "id": "hosp_ankara_1",
    "name": "Ankara Numune Hastanesi",
    "distance": "2.34 km"
  },
  "network": {
    "latency5G": {...},
    "latency4G": {...}
  }
}
```

### 2. List All Active Ambulances
**GET** `/ambulance`

**Response (200):**
```json
{
  "count": 5,
  "ambulances": [...],
  "networkStatus": {...}
}
```

### 3. Get Specific Ambulance
**GET** `/ambulance/:id`

**Response (200):**
```json
{
  "id": "...",
  "status": "EN_ROUTE",
  "patientName": "...",
  "currentLocation": {...},
  "vitals": {...},
  "triageLevel": "URGENT",
  "...": "..."
}
```

### 4. Update Ambulance Location
**PUT** `/ambulance/:id/location`

**Request Body:**
```json
{
  "latitude": 39.93,
  "longitude": 32.86
}
```

**Response (200):**
```json
{
  "success": true,
  "ambulanceId": "...",
  "location": {"lat": 39.93, "lng": 32.86},
  "distanceToHospital": "1.23 km"
}
```

### 5. Update Ambulance Status
**PUT** `/ambulance/:id/status`

**Request Body:**
```json
{
  "status": "DISPATCHED|EN_ROUTE|ON_SCENE|TRANSPORTING|AT_HOSPITAL|AVAILABLE"
}
```

**Response (200):**
```json
{
  "success": true,
  "ambulanceId": "...",
  "status": "EN_ROUTE"
}
```

### 6. Complete Transport
**DELETE** `/ambulance/:id`

**Response (200):**
```json
{
  "success": true,
  "ambulanceId": "...",
  "message": "Transport completed"
}
```

---

## Vital Signs

### 1. Submit Patient Vitals
**POST** `/vitals/:ambulanceId`

**Request Body:**
```json
{
  "vitals": {
    "heartRate": 120,
    "bloodPressure": "150/90",
    "spO2": 92,
    "temperature": 37.2,
    "respiratoryRate": 18,
    "status": "URGENT"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "ambulanceId": "...",
  "vitals": {...},
  "triageAssessment": {
    "triageLevel": "URGENT",
    "compositeScore": "65.5",
    "recommendations": [...],
    "alerts": [...]
  },
  "networkLatency": "8ms"
}
```

### 2. Get Latest Vitals
**GET** `/vitals/:ambulanceId`

**Response (200):**
```json
{
  "ambulanceId": "...",
  "patientName": "...",
  "vitals": {...},
  "triageLevel": "URGENT",
  "triageScore": "65.5",
  "lastUpdate": "2026-02-07T06:30:00Z"
}
```

### 3. Get Vitals Trend
**GET** `/vitals/:ambulanceId/trend`

**Response (200):**
```json
{
  "ambulanceId": "...",
  "vitalsHistory": [...],
  "trend": "stable|degrading|improving"
}
```

---

## Triage & Assessment

### 1. Assess Vitals
**POST** `/triage/assess`

**Request Body:**
```json
{
  "vitals": {
    "heartRate": 120,
    "bloodPressure": "150/90",
    "spO2": 92,
    "temperature": 37.2,
    "respiratoryRate": 18
  },
  "patientInfo": {
    "age": 45,
    "condition": "stable"
  }
}
```

**Response (200):**
```json
{
  "timestamp": "2026-02-07T06:30:00Z",
  "triageLevel": "URGENT",
  "compositeScore": "65.50",
  "riskScores": {
    "heartRate": 75,
    "bloodPressure": 50,
    "spO2": 85,
    "temperature": 30,
    "respiratoryRate": 50
  },
  "recommendations": [
    {
      "category": "Cardiovascular",
      "action": "Establish IV access, attach continuous cardiac monitoring",
      "priority": "IMMEDIATE"
    }
  ],
  "alerts": [
    {
      "severity": "CRITICAL",
      "message": "SEVERE HYPOXIA - Immediate oxygen therapy required"
    }
  ],
  "requiredResources": {
    "personnel": [...],
    "equipment": [...],
    "specialties": [...]
  },
  "estimatedER_Time": {...}
}
```

### 2. Comprehensive Assessment
**POST** `/triage/comprehensive`

Includes mortality risk calculation and hospital recommendations.

### 3. Get Vital Thresholds
**GET** `/triage/thresholds`

**Response (200):**
```json
{
  "heartRate": {"min": 40, "max": 160, "...": "..."},
  "bloodPressure": {"systolic_critical": 180, "...": "..."},
  "...": "..."
}
```

---

## Hospital Management

### 1. List Hospitals
**GET** `/hospital`

**Response (200):**
```json
{
  "count": 5,
  "hospitals": [
    {
      "id": "hosp_ankara_1",
      "name": "Ankara Numune Hastanesi",
      "district": "Altındağ",
      "lat": 39.9452,
      "lng": 32.8676,
      "beds": 1200,
      "erBeds": 45,
      "specialties": ["Trauma", "Cardiology"],
      "occupancyPercent": 65,
      "capacity": "AVAILABLE"
    }
  ]
}
```

### 2. Get Hospital Details
**GET** `/hospital/:id`

**Response (200):**
```json
{
  "hospital": {...},
  "incomingAmbulances": 3,
  "ambulances": [...]
}
```

### 3. Search Hospitals
**GET** `/hospital/search/criteria?district=Altındağ&specialty=Trauma&minBeds=500`

**Response (200):**
```json
{
  "count": 2,
  "hospitals": [...]
}
```

### 4. Hospital Dispatch Console
**GET** `/hospital/:id/dispatch-console`

**Response (200):**
```json
{
  "hospital": {...},
  "dispatchConsole": {