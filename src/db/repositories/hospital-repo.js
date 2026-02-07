/**
 * Hospital Repository
 * Database operations for hospitals
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

class HospitalRepository {
  /**
   * Get hospital by ID
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT * FROM hospitals WHERE id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get all hospitals with pagination
   */
  async getAll(offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM hospitals ORDER BY name ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM hospitals');
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Get hospitals by district
   */
  async getByDistrict(district) {
    const result = await pool.query(
      `SELECT * FROM hospitals WHERE district = $1 ORDER BY name`,
      [district]
    );
    return result.rows;
  }

  /**
   * Get nearest hospital by coordinates
   */
  async getNearestByCoordinates(latitude, longitude) {
    const result = await pool.query(
      `SELECT *,
              SQRT(POW(CAST(latitude AS FLOAT) - $1, 2) + 
                   POW(CAST(longitude AS FLOAT) - $2, 2)) as distance_degrees
       FROM hospitals
       WHERE status != 'CLOSED'
       ORDER BY distance_degrees ASC
       LIMIT 1`,
      [latitude, longitude]
    );
    return result.rows[0];
  }

  /**
   * Get nearby hospitals (within distance)
   */
  async getNearbyByCoordinates(latitude, longitude, radiusKm = 5) {
    const radiusDegrees = radiusKm / 111; // Approx: 1 degree = 111 km
    
    const result = await pool.query(
      `SELECT *,
              SQRT(POW(CAST(latitude AS FLOAT) - $1, 2) + 
                   POW(CAST(longitude AS FLOAT) - $2, 2)) as distance_degrees
       FROM hospitals
       WHERE status != 'CLOSED'
       AND ABS(latitude - $1) < $3
       AND ABS(longitude - $2) < $3
       ORDER BY distance_degrees ASC`,
      [latitude, longitude, radiusDegrees]
    );
    return result.rows;
  }

  /**
   * Update available beds
   */
  async updateAvailableBeds(id, availableBeds) {
    const result = await pool.query(
      `UPDATE hospitals
       SET available_beds = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [availableBeds, id]
    );
    return result.rows[0];
  }

  /**
   * Update hospital status
   */
  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE hospitals
       SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  /**
   * Get hospitals with specific capabilities
   */
  async getWithCapability(capability) {
    let columnName = 'has_trauma_center';
    
    if (capability === 'cardiac') columnName = 'has_cardiac_center';
    if (capability === 'stroke') columnName = 'has_stroke_center';
    if (capability === 'burn') columnName = 'has_burn_center';
    
    const query = `SELECT * FROM hospitals WHERE ${columnName} = TRUE AND status != 'CLOSED' ORDER BY name`;
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get hospital availability stats
   */
  async getAvailabilityStats(id) {
    const result = await pool.query(
      `SELECT 
              total_beds,
              available_beds,
              icu_beds,
              trauma_beds,
              burn_beds,
              pediatric_beds,
              status
       FROM hospitals WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) return null;
    
    const hospital = result.rows[0];
    return {
      total_beds: hospital.total_beds,
      available_beds: hospital.available_beds,
      occupancy_rate: ((hospital.total_beds - hospital.available_beds) / hospital.total_beds * 100).toFixed(2),
      icu_beds: hospital.icu_beds,
      trauma_beds: hospital.trauma_beds,
      burn_beds: hospital.burn_beds,
      pediatric_beds: hospital.pediatric_beds,
      status: hospital.status
    };
  }
}

module.exports = new HospitalRepository();
