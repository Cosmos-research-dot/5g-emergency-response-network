/**
 * Patient Repository
 * Database operations for patients
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

class PatientRepository {
  /**
   * Create a new patient
   */
  async create(data) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO patients
       (id, name, age, gender, blood_type, phone, address, emergency_contact_name,
        emergency_contact_phone, emergency_contact_relation, medical_conditions, allergies, current_medications, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
       RETURNING *`,
      [
        id,
        data.name,
        data.age,
        data.gender,
        data.blood_type,
        data.phone,
        data.address,
        data.emergency_contact_name,
        data.emergency_contact_phone,
        data.emergency_contact_relation,
        data.medical_conditions,
        data.allergies,
        data.current_medications
      ]
    );
    return result.rows[0];
  }

  /**
   * Get patient by ID
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT * FROM patients WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get all patients with pagination
   */
  async getAll(offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM patients');
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Update patient information
   */
  async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (fields.length === 0) {
      return await this.getById(id);
    }
    
    values.push(id);
    
    const result = await pool.query(
      `UPDATE patients
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );
    
    return result.rows[0];
  }

  /**
   * Search patients by name
   */
  async searchByName(name) {
    const result = await pool.query(
      `SELECT * FROM patients WHERE name ILIKE $1 ORDER BY name`,
      [`%${name}%`]
    );
    return result.rows;
  }

  /**
   * Get patient medical history
   */
  async getMedicalHistory(id) {
    const result = await pool.query(
      `SELECT id, name, age, gender, blood_type, medical_conditions, allergies, current_medications
       FROM patients WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const patient = result.rows[0];
    return {
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      blood_type: patient.blood_type,
      medical_conditions: patient.medical_conditions ? patient.medical_conditions.split(',') : [],
      allergies: patient.allergies ? patient.allergies.split(',') : [],
      current_medications: patient.current_medications ? patient.current_medications.split(',') : []
    };
  }
}

module.exports = new PatientRepository();
