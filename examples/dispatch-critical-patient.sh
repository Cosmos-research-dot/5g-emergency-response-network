#!/bin/bash

# Example: Dispatch ambulance for critical patient
# This demonstrates a complete flow from dispatch to hospital notification

set -e

API_URL="http://localhost:3000/api"
PATIENT_NAME="Fatih Kaplan"
LATITUDE=39.9452
LONGITUDE=32.8676
PATIENT_AGE=58

echo "=========================================="
echo "5G Emergency Response Network Demo"
echo "=========================================="
echo ""
echo "Scenario: Critical cardiac patient in Altındağ district"
echo "Patient: $PATIENT_NAME (Age: $PATIENT_AGE)"
echo "Location: ($LATITUDE, $LONGITUDE)"
echo ""

# Step 1: Dispatch ambulance
echo "Step 1: DISPATCHING AMBULANCE..."
echo "================================"

DISPATCH_RESPONSE=$(curl -s -X POST $API_URL/ambulance/dispatch \
  -H "Content-Type: application/json" \
  -d "{
    \"patientName\": \"$PATIENT_NAME\",
    \"latitude\": $LATITUDE,
    \"longitude\": $LONGITUDE,
    \"patientAge\": $PATIENT_AGE,
    \"condition\": \"critical\",
    \"priority\": \"CRITICAL\",
    \"initialVitals\": {
      \"heartRate\": 145,
      \"bloodPressure\": \"185/115\",
      \"spO2\": 84,
      \"temperature\": 37.8,
      \"respiratoryRate\": 26
    }
  }")

AMBULANCE_ID=$(echo $DISPATCH_RESPONSE | jq -r '.ambulanceId')
HOSPITAL=$(echo $DISPATCH_RESPONSE | jq -r '.nearestHospital.name')
NETWORK_LATENCY=$(echo $DISPATCH_RESPONSE | jq -r '.network.latency5G.latency')

echo "✓ Ambulance dispatched: $AMBULANCE_ID"
echo "✓ Nearest hospital: $HOSPITAL"
echo "✓ Network latency: ${NETWORK_LATENCY}ms (5G URLLC)"
echo ""

# Step 2: Real-time vitals submission
echo "Step 2: SUBMITTING REAL-TIME VITALS..."
echo "======================================"

for i in {1..3}; do
  # Simulate worsening vitals
  HR=$((145 + i*5))
  SBP=$((185 + i*5))
  SPO2=$((84 - i))
  
  VITALS_RESPONSE=$(curl -s -X POST $API_URL/vitals/$AMBULANCE_ID \
    -H "Content-Type: application/json" \
    -d "{
      \"vitals\": {
        \"heartRate\": $HR,
        \"bloodPressure\": \"$SBP/115\",
        \"spO2\": $SPO2,
        \"temperature\": 37.8,
        \"respiratoryRate\": 26
      }
    }")
  
  TRIAGE=$(echo $VITALS_RESPONSE | jq -r '.triageAssessment.triageLevel')
  SCORE=$(echo $VITALS_RESPONSE | jq -r '.triageAssessment.compositeScore')
  
  echo "✓ Vitals update #$i: HR=$HR, BP=$SBP/115, SpO2=$SPO2%"
  echo "  → Triage: $TRIAGE (Score: $SCORE)"
  
  sleep 1
done
echo ""

# Step 3: Ambulance location updates
echo "Step 3: TRACKING AMBULANCE LOCATION..."
echo "======================================"

LOCATIONS=(
  "39.9452 32.8676"
  "39.9480 32.8680"
  "39.9510 32.8690"
  "39.9540 32.8698"
)

for loc in "${LOCATIONS[@]}"; do
  LAT=$(echo $loc | cut -d' ' -f1)
  LNG=$(echo $loc | cut -d' ' -f2)
  
  LOCATION_RESPONSE=$(curl -s -X PUT $API_URL/ambulance/$AMBULANCE_ID/location \
    -H "Content-Type: application/json" \
    -d "{
      \"latitude\": $LAT,
      \"longitude\": $LNG
    }")
  
  DISTANCE=$(echo $LOCATION_RESPONSE | jq -r '.distanceToHospital')
  echo "✓ Location updated: ($LAT, $LNG) - Distance to hospital: $DISTANCE km"
  
  sleep 1
done
echo ""

# Step 4: Hospital dispatch console
echo "Step 4: HOSPITAL DISPATCH CONSOLE VIEW..."
echo "========================================="

HOSPITAL_ID=$(echo $DISPATCH_RESPONSE | jq -r '.nearestHospital.id')
CONSOLE_DATA=$(curl -s $API_URL/hospital/$HOSPITAL_ID/dispatch-console)

echo "Hospital: $HOSPITAL"
echo "Incoming ambulances: $(echo $CONSOLE_DATA | jq '.dispatchConsole.incomingAmbulances')"
echo "Available ER beds: $(echo $CONSOLE_DATA | jq '.dispatchConsole.availableBeds')"
echo ""

# Step 5: Update ambulance status
echo "Step 5: AMBULANCE STATUS UPDATES..."
echo "==================================="

STATUSES=("EN_ROUTE" "ON_SCENE" "TRANSPORTING" "AT_HOSPITAL")

for status in "${STATUSES[@]}"; do
  curl -s -X PUT $API_URL/ambulance/$AMBULANCE_ID/status \
    -H "Content-Type: application/json" \
    -d "{\"status\": \"$status\"}" > /dev/null
  
  echo "✓ Status: $status"
  sleep 1
done
echo ""

# Step 6: Get final status
echo "Step 6: FINAL TRANSPORT SUMMARY..."
echo "=================================="

FINAL_DATA=$(curl -s $API_URL/ambulance/$AMBULANCE_ID)

echo "Patient: $(echo $FINAL_DATA | jq -r '.patientName')"
echo "Final status: $(echo $FINAL_DATA | jq -r '.status')"
echo "Hospital: $(echo $FINAL_DATA | jq -r '.hospitalId')"
echo "Triage level: $(echo $FINAL_DATA | jq -r '.triageLevel')"
echo ""

echo "=========================================="
echo "✓ Demo Complete!"
echo "=========================================="
