/**
 * Dispatch Repository
 * Database operations for dispatches (emergency calls)
 */

const { v4: uuidv4 } = require('uuid');
const pool = require('../pool');

class DispatchRepository {
  /**
   * Create a new dispatch
   */
  async create(data) {
    const id = uuidv4();
    const result = await pool.query(
      `INSERT INTO dispatches
       (id, call_number, caller_name, caller_phone, call_location_latitude, call_location_longitude,
        call_location_address, call_description, ambulance_id, hospital_id, patient_id, dispatcher_id,
        call_received_at, status, priority, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
       RETURNING *`,
      [
        id,
        data.call_number,
        data.caller_name,
        data.caller_phone,
        data.call_location_latitude,
        data.call_location_longitude,
        data.call_location_address,
        data.call_description,
        data.ambulance_id,
        data.hospital_id,
        data.patient_id,
        data.dispatcher_id,
        data.call_received_at || new Date(),
        'PENDING',
        data.priority || 'NORMAL'
      ]
    );
    return result.rows[0];
  }

  /**
   * Get dispatch by ID
   */
  async getById(id) {
    const result = await pool.query(
      `SELECT d.*, 
              a.call_sign as ambulance_call_sign,
              h.name as hospital_name,
              p.name as patient_name,
              u.name as dispatcher_name
       FROM dispatches d
       LEFT JOIN ambulances a ON d.ambulance_id = a.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       LEFT JOIN patients p ON d.patient_id = p.id
       LEFT JOIN users u ON d.dispatcher_id = u.id
       WHERE d.id = $1`,
      [id]
    );
    return result.rows[0];
  }

  /**
   * Get all dispatches with pagination
   */
  async getAll(offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT d.*,
              a.call_sign as ambulance_call_sign,
              h.name as hospital_name,
              p.name as patient_name
       FROM dispatches d
       LEFT JOIN ambulances a ON d.ambulance_id = a.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       LEFT JOIN patients p ON d.patient_id = p.id
       ORDER BY d.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM dispatches');
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset
    };
  }

  /**
   * Get dispatches by status
   */
  async getByStatus(status, offset = 0, limit = 50) {
    const result = await pool.query(
      `SELECT d.*, a.call_sign as ambulance_call_sign FROM dispatches d
       LEFT JOIN ambulances a ON d.ambulance_id = a.id
       WHERE d.status = $1
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM dispatches WHERE status = $1',
      [status]
    );
    
    return {
      data: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  }

  /**
   * Update dispatch status
   */
  async updateStatus(id, status, timestamp = null) {
    let updateQuery = 'SET status = $1, updated_at = NOW()';
    let params = [status, id];
    
    if (timestamp && status === 'DISPATCHED') {
      updateQuery = 'SET status = $1, ambulance_dispatched_at = $3, updated_at = NOW()';
      params = [status, id, timestamp];
    } else if (timestamp && status === 'EN_ROUTE') {
      updateQuery = 'SET status = $1, ambulance_en_route_at = $3, updated_at = NOW()';
      params = [status, id, timestamp];
    } else if (timestamp && status === 'ON_SCENE') {
      updateQuery = 'SET status = $1, ambulance_on_scene_at = $3, updated_at = NOW()';
      params = [status, id, timestamp];
    } else if (timestamp && status === 'TRANSPORTING') {
      updateQuery = 'SET status = $1, ambulance_transport_start_at = $3, updated_at = NOW()';
      params = [status, id, timestamp];
    } else if (timestamp && status === 'AT_HOSPITAL') {
      updateQuery = 'SET status = $1, ambulance_arrival_at_hospital = $3, updated_at = NOW()';
      params = [status, id, timestamp];
    }
    
    const result = await pool.query(
      `UPDATE dispatches ${updateQuery} WHERE id = $2 RETURNING *`,
      params
    );
    
    return result.rows[0];
  }

  /**
   * Update dispatch priority
   */
  async updatePriority(id, priority) {
    const result = await pool.query(
      `UPDATE dispatches SET priority = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [priority, id]
    );
    return result.rows[0];
  }

  /**
   * Update triage level
   */
  async updateTriageLevel(id, triageLevel, score = null) {
    const result = await pool.query(
      `UPDATE dispatches SET triage_level = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [triageLevel, id]
    );
    return result.rows[0];
  }

  /**
   * Get recent dispatches (last N)
   */
  async getRecent(limit = 20) {
    const result = await pool.query(
      `SELECT d.*, a.call_sign as ambulance_call_sign, h.name as hospital_name
       FROM dispatches d
       LEFT JOIN ambulances a ON d.ambulance_id = a.id
       LEFT JOIN hospitals h ON d.hospital_id = h.id
       ORDER BY d.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  /**
   * Count dispatches by status
   */
  async countByStatus() {
    const result = await pool.query(
      `SELECT status, COUNT(*) as count FROM dispatches GROUP BY status`
    );
    return result.rows;
  }
}

module.exports = new DispatchRepository();
