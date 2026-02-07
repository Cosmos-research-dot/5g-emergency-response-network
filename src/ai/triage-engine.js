/**
 * AI Triage Engine
 * Analyzes patient vital signs and generates priority scores and recommendations
 * Based on START (Simple Triage And Rapid Treatment) and NACA scales
 */

const config = require('../config');

class TriageEngine {
  constructor() {
    this.riskFactors = {
      heartRate: this.analyzeHeartRate,
      bloodPressure: this.analyzeBloodPressure,
      spO2: this.analyzeOxygen,
      temperature: this.analyzeTemperature,
      respiratoryRate: this.analyzeRespiratoryRate
    };
  }

  /**
   * Perform complete triage assessment
   */
  assess(vitals, patientInfo = {}) {
    const timestamp = new Date().toISOString();
    
    // Calculate individual risk scores
    const riskScores = {
      heartRate: this.analyzeHeartRate(vitals.heartRate),
      bloodPressure: this.analyzeBloodPressure(vitals.bloodPressure),
      spO2: this.analyzeOxygen(vitals.spO2),
      temperature: this.analyzeTemperature(vitals.temperature),
      respiratoryRate: this.analyzeRespiratoryRate(vitals.respiratoryRate)
    };

    // Calculate composite score
    const compositeScore = this.calculateCompositeScore(riskScores);
    
    // Determine triage level
    const triageLevel = this.determineTriage(compositeScore);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(vitals, triageLevel, patientInfo);

    return {
      timestamp,
      triageLevel,
      compositeScore: compositeScore.toFixed(2),
      riskScores,
      recommendations,
      severity: {
        percentage: compositeScore,
        description: this.getSeverityDescription(compositeScore)
      },
      alerts: this.generateAlerts(vitals, triageLevel),
      requiredResources: this.identifyRequiredResources(triageLevel, vitals),
      estimatedER_Time: this.estimateERTime(triageLevel)
    };
  }

  /**
   * Analyze heart rate
   */
  analyzeHeartRate(hr) {
    if (hr < 40 || hr > 140) return 100; // Critical
    if (hr < 50 || hr > 120) return 75; // High risk
    if (hr < 60 || hr > 100) return 50; // Moderate
    return 20; // Normal
  }

  /**
   * Analyze blood pressure
   */
  analyzeBloodPressure(bp) {
    const [systolic, diastolic] = bp.split('/').map(Number);
    
    if (systolic > 180 || systolic < 60 || diastolic > 120 || diastolic < 40) {
      return 100; // Critical
    }
    if (systolic > 160 || systolic < 80 || diastolic > 110 || diastolic < 50) {
      return 75; // High risk
    }
    if (systolic > 140 || systolic < 90 || diastolic > 90) {
      return 50; // Moderate
    }
    return 20; // Normal
  }

  /**
   * Analyze oxygen saturation
   */
  analyzeOxygen(spO2) {
    if (spO2 < 85) return 100; // Critical
    if (spO2 < 90) return 85; // High risk
    if (spO2 < 94) return 50; // Moderate
    return 20; // Normal
  }

  /**
   * Analyze temperature
   */
  analyzeTemperature(temp) {
    if (temp < 35 || temp > 40) return 100; // Critical
    if (temp < 36 || temp > 39) return 50; // Moderate
    if (temp < 36.5 || temp > 38.5) return 30; // Slight deviation
    return 20; // Normal
  }

  /**
   * Analyze respiratory rate
   */
  analyzeRespiratoryRate(rr) {
    if (rr < 8 || rr > 40) return 100; // Critical
    if (rr < 10 || rr > 30) return 75; // High risk
    if (rr < 12 || rr > 25) return 50; // Moderate
    return 20; // Normal
  }

  /**
   * Calculate composite risk score (0-100)
   */
  calculateCompositeScore(riskScores) {
    const scores = Object.values(riskScores);
    const average = scores.reduce((a, b) => a + b) / scores.length;
    
    // Weight critical values higher
    const criticalCount = scores.filter(s => s === 100).length;
    const adjustedScore = average + (criticalCount * 10);
    
    return Math.min(100, adjustedScore);
  }

  /**
   * Determine triage level from score
   */
  determineTriage(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 50) return 'URGENT';
    return 'STABLE';
  }

  /**
   * Generate clinical recommendations
   */
  generateRecommendations(vitals, triageLevel, patientInfo) {
    const recommendations = [];
    const [systolic, diastolic] = vitals.bloodPressure.split('/').map(Number);

    // Cardiovascular recommendations
    if (vitals.heartRate > 120 || systolic > 160) {
      recommendations.push({
        category: 'Cardiovascular',
        action: 'Establish IV access, attach continuous cardiac monitoring',
        priority: 'IMMEDIATE'
      });
    }

    // Respiratory recommendations
    if (vitals.spO2 < 90) {
      recommendations.push({
        category: 'Respiratory',
        action: 'Initiate oxygen therapy, target SpO2 > 94%',
        priority: 'IMMEDIATE'
      });
    }

    if (vitals.respiratoryRate > 25) {
      recommendations.push({
        category: 'Respiratory',
        action: 'Prepare for possible airway management',
        priority: 'URGENT'
      });
    }

    // Temperature recommendations
    if (vitals.temperature > 39) {
      recommendations.push({
        category: 'Thermoregulation',
        action: 'Initiate fever management, consider IV fluids',
        priority: 'URGENT'
      });
    }

    // Triage-specific recommendations
    if (triageLevel === 'CRITICAL') {
      recommendations.push({
        category: 'General',
        action: 'Prepare for intensive care, have resuscitation team ready',
        priority: 'IMMEDIATE'
      });
    }

    return recommendations;
  }

  /**
   * Generate alerts for critical findings
   */
  generateAlerts(vitals, triageLevel) {
    const alerts = [];

    if (triageLevel === 'CRITICAL') {
      alerts.push({
        severity: 'CRITICAL',
        message: 'CRITICAL CONDITION DETECTED - Immediate intervention required'
      });
    }

    if (vitals.heartRate < 40) {
      alerts.push({
        severity: 'CRITICAL',
        message: 'SEVERE BRADYCARDIA - Monitor for cardiac output compromise'
      });
    }

    if (vitals.spO2 < 85) {
      alerts.push({
        severity: 'CRITICAL',
        message: 'SEVERE HYPOXIA - Immediate oxygen therapy required'
      });
    }

    if (vitals.temperature < 35 || vitals.temperature > 40) {
      alerts.push({
        severity: 'CRITICAL',
        message: 'CRITICAL TEMPERATURE - Risk of organ failure'
      });
    }

    return alerts;
  }

  /**
   * Identify required medical resources
   */
  identifyRequiredResources(triageLevel, vitals) {
    const resources = {
      personnel: [],
      equipment: [],
      specialties: []
    };

    // Personnel requirements
    if (triageLevel === 'CRITICAL') {
      resources.personnel = ['Attending Physician', 'Trauma Surgeon', 'Anesthesiologist', 'Nursing Staff'];
    } else if (triageLevel === 'URGENT') {
      resources.personnel = ['Physician', 'Nurse', 'EMT'];
    } else {
      resources.personnel = ['Nurse', 'EMT'];
    }

    // Equipment requirements
    if (vitals.spO2 < 94) {
      resources.equipment.push('Oxygen delivery system', 'Pulse oximeter');
    }
    if (vitals.heartRate < 50 || vitals.heartRate > 120) {
      resources.equipment.push('Cardiac monitor', 'Defibrillator');
    }
    
    resources.equipment.push('IV access kits', 'Blood pressure monitor', 'Thermometer');

    // Specialty requirements
    if (vitals.heartRate < 40 || vitals.heartRate > 140) {
      resources.specialties.push('Cardiology');
    }
    if (vitals.respiratoryRate > 30 || vitals.spO2 < 85) {
      resources.specialties.push('Pulmonology');
    }
    if (vitals.temperature > 39) {
      resources.specialties.push('Infectious Diseases');
    }

    return resources;
  }

  /**
   * Estimate time to ER full assessment
   */
  estimateERTime(triageLevel) {
    const times = {
      CRITICAL: { min: 5, max: 10, avgMin: 7 },
      URGENT: { min: 10, max: 20, avgMin: 15 },
      STABLE: { min: 20, max: 60, avgMin: 45 }
    };
    return times[triageLevel];
  }

  /**
   * Get severity description
   */
  getSeverityDescription(score) {
    if (score >= 80) return 'Life-threatening - Immediate action required';
    if (score >= 60) return 'Serious - Urgent care needed';
    if (score >= 40) return 'Moderate - Close monitoring recommended';
    if (score >= 20) return 'Mild - Routine care appropriate';
    return 'Stable - Standard monitoring';
  }

  /**
   * Calculate mortality risk score (simplified)
   */
  calculateMortalityRisk(vitals, age, comorbidities = []) {
    let risk = 5; // baseline 5%

    // Age factor
    if (age > 70) risk += 15;
    else if (age > 60) risk += 10;
    else if (age > 50) risk += 5;

    // Vital signs factor
    if (vitals.heartRate < 40 || vitals.heartRate > 140) risk += 20;
    if (vitals.spO2 < 85) risk += 25;
    if (vitals.temperature < 35 || vitals.temperature > 40) risk += 15;

    // Comorbidities
    const riskByCondition = {
      'cardiac_disease': 10,
      'diabetes': 8,
      'hypertension': 5,
      'respiratory_disease': 12,
      'kidney_disease': 15,
      'cancer': 20
    };

    comorbidities.forEach(condition => {
      risk += riskByCondition[condition] || 0;
    });

    return Math.min(95, risk);
  }

  /**
   * Generate comprehensive patient assessment summary
   */
  generateAssessmentSummary(vitals, patientInfo = {}) {
    const assessment = this.assess(vitals, patientInfo);
    
    return {
      ...assessment,
      mortalityRisk: this.calculateMortalityRisk(
        vitals,
        patientInfo.age || 45,
        patientInfo.comorbidities || []
      ),
      recommendation: {
        destination: this.recommendHospital(assessment.triageLevel),
        mode: this.recommendTransportMode(assessment.triageLevel),
        clinician: this.recommendClinician(assessment.triageLevel)
      }
    };
  }

  /**
   * Recommend hospital type based on triage level
   */
  recommendHospital(triageLevel) {
    if (triageLevel === 'CRITICAL') {
      return 'Level 1 Trauma Center / Teaching Hospital';
    }
    if (triageLevel === 'URGENT') {
      return 'Level 2 Hospital with full emergency services';
    }
    return 'Level 3 Hospital / Urgent Care Center';
  }

  /**
   * Recommend transport mode
   */
  recommendTransportMode(triageLevel) {
    if (triageLevel === 'CRITICAL') {
      return 'Advanced Life Support (ALS) Ambulance';
    }
    if (triageLevel === 'URGENT') {
      return 'Advanced Life Support (ALS) or Basic Life Support (BLS)';
    }
    return 'Basic Life Support (BLS) Ambulance';
  }

  /**
   * Recommend clinician level
   */
  recommendClinician(triageLevel) {
    if (triageLevel === 'CRITICAL') {
      return 'Physician or Paramedic with critical care certification';
    }
    if (triageLevel === 'URGENT') {
      return 'Paramedic or Advanced EMT';
    }
    return 'EMT or Paramedic';
  }
}

module.exports = TriageEngine;

