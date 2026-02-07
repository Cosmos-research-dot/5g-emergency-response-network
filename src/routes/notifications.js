/**
 * Notification API Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const auth = require('../middleware/auth');

/**
 * Get user's notification preferences
 */
router.get('/preferences', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = 'SELECT * FROM notification_preferences WHERE user_id = $1';
    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferences not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update notification preferences
 */
router.put('/preferences', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      push_enabled,
      sms_enabled,
      whatsapp_enabled,
      email_enabled,
      inapp_enabled,
      dnd_enabled,
      dnd_start_time,
      dnd_end_time,
      dnd_override_critical,
      language,
      whatsapp_phone
    } = req.body;

    const query = `
      UPDATE notification_preferences SET
        push_enabled = COALESCE($1, push_enabled),
        sms_enabled = COALESCE($2, sms_enabled),
        whatsapp_enabled = COALESCE($3, whatsapp_enabled),
        email_enabled = COALESCE($4, email_enabled),
        inapp_enabled = COALESCE($5, inapp_enabled),
        dnd_enabled = COALESCE($6, dnd_enabled),
        dnd_start_time = COALESCE($7, dnd_start_time),
        dnd_end_time = COALESCE($8, dnd_end_time),
        dnd_override_critical = COALESCE($9, dnd_override_critical),
        language = COALESCE($10, language),
        whatsapp_phone = COALESCE($11, whatsapp_phone),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $12
      RETURNING *
    `;

    const result = await pool.query(query, [
      push_enabled,
      sms_enabled,
      whatsapp_enabled,
      email_enabled,
      inapp_enabled,
      dnd_enabled,
      dnd_start_time,
      dnd_end_time,
      dnd_override_critical,
      language,
      whatsapp_phone,
      userId
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's notifications
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { category, status, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);

    res.json({
      notifications: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get single notification
 */
router.get('/:notificationId', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const query = `
      SELECT * FROM notifications 
      WHERE notification_id = $1 AND user_id = $2
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Acknowledge notification
 */
router.post('/:notificationId/acknowledge', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { response } = req.body;
    const userId = req.user.id;

    const updateQuery = `
      UPDATE notifications 
      SET acknowledged = true, 
          acknowledged_at = CURRENT_TIMESTAMP,
          acknowledgment_response = $1
      WHERE notification_id = $2 AND user_id = $3
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [response, notificationId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Record acknowledgment
    await pool.query(`
      INSERT INTO notification_acknowledgments (notification_id, user_id, response_type, response_timestamp)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
    `, [result.rows[0].id, userId, response]);

    res.json({
      success: true,
      notification: result.rows[0]
    });
  } catch (error) {
    console.error('Acknowledge notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Mark notification as read
 */
router.put('/:notificationId/read', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const query = `
      UPDATE notifications 
      SET status = 'read'
      WHERE notification_id = $1 AND user_id = $2
      RETURNING *
    `;

    const result = await pool.query(query, [notificationId, userId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get unacknowledged critical notifications
 */
router.get('/critical/unacknowledged', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT * FROM notifications 
      WHERE user_id = $1 
        AND priority = 'critical'
        AND requires_acknowledgment = true
        AND acknowledged = false
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get unacknowledged error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete notification
 */
router.delete('/:notificationId', auth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const query = `
      DELETE FROM notifications 
      WHERE notification_id = $1 AND user_id = $2
      RETURNING notification_id
    `;

    const result = await pool.query(query, [notificationId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ success: true, notificationId });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get notification templates
 */
router.get('/templates/list', async (req, res) => {
  try {
    const query = 'SELECT id, code, name, category, priority FROM notification_templates ORDER BY category';
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get analytics
 */
router.get('/analytics/summary', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;

    const query = `
      SELECT 
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN acknowledged = true THEN 1 ELSE 0 END) as acknowledged,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM notifications
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
      GROUP BY category
    `;

    const result = await pool.query(query, [userId]);

    res.json({
      period: `${days} days`,
      data: result.rows
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
