/**
 * Vital Signs Generator
 * Simulates realistic patient vital signs with variability and pathological conditions
 */

const config = require('../config');

class VitalSignsGenerator {
  constructor(patientProfile = {}) {
    this.profile = {
      age: patientProfile.age || 45,
      condition: patientProfile.condition || 'stable', // stable, critical, recovering
      history: patientProfile.history || []
    };
    
    // Initialize baseline vitals
    this.baseline = this.getBaselineVitals();
  }

  /**
   * Get baseline vitals based on age
   */
  getBaselineVitals() {
    const age = this.profile.age;
    return {
      heartRate: 70 - (age / 10) + Math.random() * 20,
      systolic: 110 + (age / 20),
      diastolic: 70 + (age / 30),
      spO2: 97,
      temperature: 36.8,
      respiratoryRate: 14
    };
  }

  /**
   * Generate current vital signs with trending
   */
  generateVitals(trend = 'stable') {
    let vitals = { ...this.baseline };

    // Apply condition-based modifications
    if (this.profile.condition === 'critical') {
      vitals = this.applyCriticalModifications(vitals);
    } else if (this.profile.condition === 'recovering') {
      vitals = this.applyRecoveringModifications(vitals);
    } else {
      vitals = this.applyStableModifications(vitals);
    }

    // Apply trend
    if (trend === 'deteriorating') {
      vitals.heartRate += Math.random() * 10;
      vitals.spO2 -= Math.random() * 5;
      vitals.respiratoryRate += Math.random() * 5;
    } else if (trend === 'improving') {
      vitals.heartRate -= Math.random() * 5;
      vitals.spO2 += Math.random() * 3;
      vitals.respiratoryRate -= Math.random() * 2;
    }

    return {
      timestamp: new Date().toISOString(),
      heartRate: Math.round(vitals.heartRate),
      bloodPressure: `${Math.round(vitals.systolic)}/${Math.round(vitals.diastolic)}`,
      spO2: Math.min(100, Math.max(70, Math.round(vitals.spO2 * 10) / 10)),
      temperature: Math.round(vitals.temperature * 10) / 10,
      respiratoryRate: Math.round(vitals.respiratoryRate),
      status: this.getVitalStatus(vitals)
    };
  }

  /**
   * Apply critical condition modifications
   */
  applyCriticalModifications(vitals) {
    return {
      heartRate: 110 + Math.random() * 60, // 110-170 bpm (tachycardia)
      systolic: 70 + Math.random() * 40, // 70-110 (hypotension)
      diastolic: 40 + Math.random() * 30, // 40-70
      spO2: 70 + Math.random() * 15, // 70-85% (severe hypoxia)
      temperature: 35.5 + Math.random() * 4, // 35.5-39.5°C (wide range)
      respiratoryRate: 22 + Math.random() * 20 // 22-42 (severe tachypnea)
    };
  }

  /**
   * Apply recovering condition modifications
   */
  applyRecoveringModifications(vitals) {
    return {
      heartRate: vitals.heartRate + Math.random() * 10,
      systolic: vitals.systolic + Math.random() * 10,
      diastolic: vitals.diastolic + Math.random() * 8,
      spO2: Math.min(100, vitals.spO2 + Math.random() * 5),
      temperature: vitals.temperature + Math.random() * 0.5,
      respiratoryRate: vitals.respiratoryRate + Math.random() * 3
    };
  }

  /**
   * Apply stable condition modifications (normal variations)
   */
  applyStableModifications(vitals) {
    return {
      heartRate: vitals.heartRate + (Math.random() - 0.5) * 10,
      systolic: vitals.systolic + (Math.random() - 0.5) * 8,
      diastolic: vitals.diastolic + (Math.random() - 0.5) * 6,
      spO2: Math.min(100, Math.max(92, vitals.spO2 + (Math.random() - 0.5) * 2)),
      temperature: vitals.temperature + (Math.random() - 0.5) * 0.4,
      respiratoryRate: vitals.respiratoryRate + (Math.random() - 0.5) * 4
    };
  }

  /**
   * Determine vital status based on values
   */
  getVitalStatus(vitals) {
    const criticalThresholds = config.vitals;
    
    const checks = [
      vitals.heartRate < 40 || vitals.heartRate > 150,
      vitals.spO2 < 85,
      vitals.temperature < 35 || vitals.temperature > 40,
      vitals.respiratoryRate < 8 || vitals.respiratoryRate > 40,
      vitals.systolic > 180 || vitals.systolic < 60
    ];

    if (checks.some(c => c)) {
      return 'CRITICAL';
    }

    const urgentChecks = [
      vitals.heartRate > 120 || vitals.heartRate < 50,
      vitals.spO2 < 90,
      vitals.temperature < 36 || vitals.temperature > 39,
      vitals.respiratoryRate > 25
    ];

    if (urgentChecks.some(c => c)) {
      return 'URGENT';
    }

    return 'STABLE';
  }

  /**
   * Generate ECG data (simplified)
   */
  generateECG() {
    const hr = this.baseline.heartRate;
    const intervals = Math.round(1000 / (hr / 60)); // milliseconds between beats
    
    return {
      heartRate: Math.round(hr),
      intervals: intervals,
      rhythm: this.generateRhythm(),
      segments: this.generateSegments()
    };
  }

  /**
   * Generate heart rhythm
   */
  generateRhythm() {
    const rhythms = ['NORMAL_SINUS', 'SINUS_TACHYCARDIA', 'SINUS_BRADYCARDIA', 'IRREGULAR'];
    
    if (this.profile.condition === 'critical') {
      return rhythms[Math.random() > 0.5 ? 3 : 1]; // irregular or tachy
    }
    
    return rhythms[0]; // normal
  }

  /**
   * Generate ECG segments
   */
  generateSegments() {
    return {
      pWave: 40 + Math.random() * 20,
      prInterval: 120 + Math.random() * 40,
      qrsComplex: 80 + Math.random() * 40,
      stSegment: 0 + (Math.random() - 0.5) * 2,
      tWave: 100 + Math.random() * 50,
      qtInterval: 360 + Math.random() * 80
    };
  }

  /**
   * Generate blood gas values
   */
  generateBloodGas() {
    return {
      pH: 7.35 + (Math.random() - 0.5) * 0.2,
      pCO2: 35 + (Math.random() - 0.5) * 10,
      pO2: 80 + (Math.random() - 0.5) * 30,
      hCO3: 22 + (Math.random() - 0.5) * 8,
      lactate: 1 + Math.random() * 2
    };
  }

  /**
   * Generate complete vital signs package
   */
  generateCompleteScan(trend = 'stable') {
    const vitals = this.generateVitals(trend);
    
    return {
      ...vitals,
      ecg: this.generateECG(),
      bloodGas: this.generateBloodGas(),
      systemQuality: {
        signalStrength: Math.round(Math.random() * 100),
        dataReliability: Math.random() > 0.1 ? 'GOOD' : 'DEGRADED'
      }
    };
  }
}

module.exports = VitalSignsGenerator;
