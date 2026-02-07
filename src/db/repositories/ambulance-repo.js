/**
 * Ambulance Repository
 * Database operations for ambulances
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

class AmbulanceRepository {
  /**
   * Create a new ambulance dispatch record
   */
  async create(data) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO ambulances 
       (id, call_sign, station_id, license_plate, model, year, ambulance_type, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [id, data.call_sign, data.station_id, data.license_plate, data.model, data.year, data.ambulance_type, 'AVAILABLE']
    );
    return result.rows[0];
  }

  /**
   * Get ambulance by ID
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT a.*, s.name as station_name FROM ambulances a
       LEFT JOIN ambulance_stations s ON a.station_id = s.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get all ambulances with pagination
   */
  async getAll(offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT a.*, s.name as station_name FROM ambulances a
       LEFT JOIN ambulance_stations s ON a.station_id = s.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM ambulances');
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Get ambulances by status
   */
  async getByStatus(status, offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT a.*, s.name as station_name FROM ambulances a
       LEFT JOIN ambulance_stations s ON a.station_id = s.id
       WHERE a.status = $1
       ORDER BY a.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM ambulances WHERE status = $1',
      [status]
    );
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Get available ambulances
   */
  async getAvailable(latitude, longitude, limit = 5) {
    const result = await pool.query(
      `SELECT a.*, s.name as station_name,
              SQRT(POW(CAST(a.current_latitude AS FLOAT) - $1, 2) + 
                   POW(CAST(a.current_longitude AS FLOAT) - $2, 2)) as distance
       FROM ambulances a
       LEFT JOIN ambulance_stations s ON a.station_id = s.id
       WHERE a.status = 'AVAILABLE'
       ORDER BY distance ASC
       LIMIT $3`,
      [latitude, longitude, limit]
    );
    return result.rows;
  }

  /**
   * Update ambulance status
   */
  async updateStatus(id, status) {
    const result = await pool.query(
      `UPDATE ambulances 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }

  /**
   * Update ambulance location (GPS)
   */
  async updateLocation(id, latitude, longitude) {
    const result = await pool.query(
      `UPDATE ambulances 
       SET current_latitude = $1, current_longitude = $2, last_location_update = NOW(), updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [latitude, longitude, id]
    );
    return result.rows[0];
  }

  /**
   * Get ambulances by station
   */
  async getByStation(stationId) {
    const result = await pool.query(
      `SELECT * FROM ambulances WHERE station_id = $1 ORDER BY call_sign`,
      [stationId]
    );
    return result.rows;
  }

  /**
   * Count ambulances by status
   */
  async countByStatus() {
    const result = await pool.query(
      `SELECT status, COUNT(*) as count FROM ambulances GROUP BY status`
    );
    return result.rows;
  }
}

module.exports = new AmbulanceRepository();
