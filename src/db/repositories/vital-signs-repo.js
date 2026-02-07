/**
 * Vital Signs Repository
 * Database operations for vital signs history (time-series data)
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

class VitalSignsRepository {
  /**
   * Record vital signs
   */
  async record(data) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO vital_signs_history
       (id, dispatch_id, ambulance_id, patient_id, heart_rate, systolic_bp, diastolic_bp,
        respiratory_rate, temperature, oxygen_saturation, blood_glucose, consciousness_level,
        pain_level, triage_level, triage_score, recorded_by_user_id, recorded_at,
        network_latency_ms, network_signal_strength, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
       RETURNING *`,
      [
        id,
        data.dispatch_id,
        data.ambulance_id,
        data.patient_id,
        data.heart_rate,
        data.systolic_bp,
        data.diastolic_bp,
        data.respiratory_rate,
        data.temperature,
        data.oxygen_saturation,
        data.blood_glucose,
        data.consciousness_level,
        data.pain_level,
        data.triage_level,
        data.triage_score,
        data.recorded_by_user_id,
        data.recorded_at || new Date(),
        data.network_latency_ms,
        data.network_signal_strength
      ]
    );
    return result.rows[0];
  }

  /**
   * Get vital signs by dispatch ID
   */
  async getByDispatchId(dispatchId) {
    const result = await pool.query(
      `SELECT * FROM vital_signs_history WHERE dispatch_id = $1 ORDER BY recorded_at ASC`,
      [dispatchId]
    );
    return result.rows;
  }

  /**
   * Get vital signs by ambulance ID
   */
  async getByAmbulanceId(ambulanceId, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM vital_signs_history WHERE ambulance_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
      [ambulanceId, limit]
    );
    return result.rows;
  }

  /**
   * Get vital signs by patient ID
   */
  async getByPatientId(patientId, limit = 100) {
    const result = await pool.query(
      `SELECT * FROM vital_signs_history WHERE patient_id = $1 ORDER BY recorded_at DESC LIMIT $2`,
      [patientId, limit]
    );
    return result.rows;
  }

  /**
   * Get latest vital signs for dispatch
   */
  async getLatestByDispatchId(dispatchId) {
    const result = await pool.query(
      `SELECT * FROM vital_signs_history WHERE dispatch_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
      [dispatchId]
    );
    return result.rows[0];
  }

  /**
   * Get vital signs trend for dispatch
   */
  async getTrendByDispatchId(dispatchId) {
    const result = await pool.query(
      `SELECT 
              recorded_at,
              heart_rate,
              systolic_bp,
              diastolic_bp,
              respiratory_rate,
              temperature,
              oxygen_saturation,
              blood_glucose,
              pain_level,
              triage_level,
              triage_score
       FROM vital_signs_history 
       WHERE dispatch_id = $1
       ORDER BY recorded_at ASC`,
      [dispatchId]
    );
    return result.rows;
  }

  /**
   * Get vital signs statistics for dispatch
   */
  async getStatsByDispatchId(dispatchId) {
    const result = await pool.query(
      `SELECT
              COUNT(*) as measurement_count,
              AVG(CAST(heart_rate AS FLOAT)) as avg_heart_rate,
              MAX(CAST(heart_rate AS FLOAT)) as max_heart_rate,
              MIN(CAST(heart_rate AS FLOAT)) as min_heart_rate,
              AVG(CAST(systolic_bp AS FLOAT)) as avg_systolic_bp,
              AVG(CAST(diastolic_bp AS FLOAT)) as avg_diastolic_bp,
              AVG(CAST(oxygen_saturation AS FLOAT)) as avg_oxygen_saturation,
              AVG(CAST(temperature AS FLOAT)) as avg_temperature,
              MIN(recorded_at) as first_recorded,
              MAX(recorded_at) as last_recorded
       FROM vital_signs_history
       WHERE dispatch_id = $1`,
      [dispatchId]
    );
    
    if (result.rows.length === 0) return null;
    
    const stats = result.rows[0];
    return {
      measurement_count: parseInt(stats.measurement_count),
      heart_rate: {
        average: parseFloat(stats.avg_heart_rate).toFixed(1),
        max: parseInt(stats.max_heart_rate),
        min: parseInt(stats.min_heart_rate)
      },
      blood_pressure: {
        avg_systolic: parseFloat(stats.avg_systolic_bp).toFixed(1),
        avg_diastolic: parseFloat(stats.avg_diastolic_bp).toFixed(1)
      },
      oxygen_saturation: parseFloat(stats.avg_oxygen_saturation).toFixed(1),
      temperature: parseFloat(stats.avg_temperature).toFixed(2),
      duration: {
        first_recorded: stats.first_recorded,
        last_recorded: stats.last_recorded
      }
    };
  }

  /**
   * Delete vital signs by dispatch (cleanup)
   */
  async deleteByDispatchId(dispatchId) {
    await pool.query(
      `DELETE FROM vital_signs_history WHERE dispatch_id = $1`,
      [dispatchId]
    );
  }
}

module.exports = new VitalSignsRepository();
