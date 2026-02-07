/**
 * User Repository
 * Handles all user database operations
 */

const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const pool = require('../pool');

class UserRepository {
  /**
   * Create a new user
   */
  static async create(userData) {
    const {
      email,
      name,
      role,
      password,
      phone,
      stationId,
      hospitalId
    } = userData;

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users (
        id, email, name, password_hash, role, phone, station_id, hospital_id, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
      RETURNING id, email, name, role, phone, station_id, hospital_id, created_at;
    `;

    const result = await pool.query(query, [userId, email, name, passwordHash, role, phone, stationId, hospitalId]);
    return result.rows[0];
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = TRUE;';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Find user by ID
   */
  static async findById(userId) {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = TRUE;';
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Verify password
   */
  static async verifyPassword(userId, password) {
    const user = await this.findById(userId);
    if (!user) return false;

    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Update user
   */
  static async update(userId, updates) {
    const allowedFields = ['name', 'phone', 'status'];
    const setClause = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (setClause.length === 0) {
      return this.findById(userId);
    }

    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${setClause.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, name, role, phone, status, updated_at;
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Update last login
   */
  static async updateLastLogin(userId, ipAddress, userAgent) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP, last_ip_address = $2, last_user_agent = $3
      WHERE id = $1
      RETURNING id, email, last_login;
    `;

    const result = await pool.query(query, [userId, ipAddress, userAgent]);
    return result.rows[0];
  }

  /**
   * Change password
   */
  static async changePassword(userId, oldPassword, newPassword) {
    const user = await this.findById(userId);
    if (!user) throw new Error('User not found');

    const isValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isValid) throw new Error('Invalid current password');

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Add to password history
    const historyQuery = `
      INSERT INTO password_history (user_id, password_hash)
      VALUES ($1, $2);
    `;
    await pool.query(historyQuery, [userId, user.password_hash]);

    // Update password
    const updateQuery = `
      UPDATE users
      SET password_hash = $2, last_password_change = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, last_password_change;
    `;

    const result = await pool.query(updateQuery, [userId, newPasswordHash]);
    return result.rows[0];
  }

  /**
   * Reset password (without knowing old password)
   */
  static async resetPassword(userId, newPassword) {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    const query = `
      UPDATE users
      SET password_hash = $2, last_password_change = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, last_password_change;
    `;

    const result = await pool.query(query, [userId, newPasswordHash]);
    return result.rows[0];
  }

  /**
   * Record failed login attempt
   */
  static async recordFailedLogin(email, ipAddress, userAgent) {
    const user = await this.findByEmail(email);
    if (!user) return null;

    const attempts = (user.failed_login_attempts || 0) + 1;
    const maxAttempts = 5;
    const lockoutDuration = 30 * 60; // 30 minutes

    let lockedUntil = null;
    if (attempts >= maxAttempts) {
      lockedUntil = new Date(Date.now() + lockoutDuration * 1000);
    }

    const query = `
      UPDATE users
      SET failed_login_attempts = $2, locked_until = $3
      WHERE id = $1;
    `;

    await pool.query(query, [user.id, attempts, lockedUntil]);

    // Log failed login
    await this.logLogin(user.id, email, 'FAILED', 'Invalid credentials', ipAddress, userAgent);

    return { attempts, locked: !!lockedUntil };
  }

  /**
   * Clear failed login attempts
   */
  static async clearFailedAttempts(userId) {
    const query = `
      UPDATE users
      SET failed_login_attempts = 0, locked_until = NULL
      WHERE id = $1;
    `;

    await pool.query(query, [userId]);
  }

  /**
   * Log login attempt
   */
  static async logLogin(userId, email, status, reason = null, ipAddress = null, userAgent = null) {
    const query = `
      INSERT INTO login_audit (user_id, email, status, reason, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6);
    `;

    await pool.query(query, [userId, email, status, reason, ipAddress, userAgent]);
  }

  /**
   * Get all users with pagination
   */
  static async getAll(limit = 20, offset = 0, role = null) {
    let query = 'SELECT id, email, name, role, phone, status, created_at FROM users WHERE is_active = TRUE';
    const values = [];

    if (role) {
      query += ` AND role = $1`;
      values.push(role);
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2};`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Count users
   */
  static async count(role = null) {
    let query = 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE';
    const values = [];

    if (role) {
      query += ` AND role = $1`;
      values.push(role);
    }

    const result = await pool.query(query, values);
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete user (soft delete)
   */
  static async delete(userId) {
    const query = `
      UPDATE users
      SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Enable two-factor authentication
   */
  static async enableTwoFactor(userId, secret) {
    const query = `
      UPDATE users
      SET two_factor_enabled = TRUE, two_factor_secret = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, two_factor_enabled;
    `;

    const result = await pool.query(query, [userId, secret]);
    return result.rows[0];
  }

  /**
   * Disable two-factor authentication
   */
  static async disableTwoFactor(userId) {
    const query = `
      UPDATE users
      SET two_factor_enabled = FALSE, two_factor_secret = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, two_factor_enabled;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Store session token
   */
  static async storeSessionToken(userId, tokenHash, refreshTokenHash, expiresAt, ipAddress, userAgent) {
    const query = `
      INSERT INTO session_tokens (user_id, token_hash, refresh_token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, expires_at;
    `;

    const result = await pool.query(query, [userId, tokenHash, refreshTokenHash, expiresAt, ipAddress, userAgent]);
    return result.rows[0];
  }

  /**
   * Get active sessions for user
   */
  static async getActiveSessions(userId) {
    const query = `
      SELECT id, expires_at, ip_address, user_agent, created_at, last_used
      FROM session_tokens
      WHERE user_id = $1 AND is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_used DESC;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Revoke session token
   */
  static async revokeSession(userId, sessionId) {
    const query = `
      UPDATE session_tokens
      SET is_revoked = TRUE
      WHERE user_id = $1 AND id = $2;
    `;

    await pool.query(query, [userId, sessionId]);
  }

  /**
   * Revoke all sessions for user
   */
  static async revokeAllSessions(userId) {
    const query = `
      UPDATE session_tokens
      SET is_revoked = TRUE
      WHERE user_id = $1 AND is_revoked = FALSE;
    `;

    await pool.query(query, [userId]);
  }

  /**
   * Create password reset token
   */
  static async createPasswordResetToken(userId) {
    const tokenId = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const query = `
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, expires_at;
    `;

    const result = await pool.query(query, [tokenId, userId, tokenId, expiresAt]);
    return result.rows[0];
  }

  /**
   * Verify password reset token
   */
  static async verifyPasswordResetToken(tokenId) {
    const query = `
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = $1;
    `;

    const result = await pool.query(query, [tokenId]);
    if (!result.rows[0]) return null;

    const token = result.rows[0];
    if (token.used_at) return null; // Token already used
    if (new Date(token.expires_at) < new Date()) return null; // Token expired

    return token;
  }

  /**
   * Use password reset token
   */
  static async usePasswordResetToken(tokenId) {
    const query = `
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1;
    `;

    await pool.query(query, [tokenId]);
  }

  /**
   * Log data access (for HIPAA compliance)
   */
  static async logDataAccess(userId, resourceType, resourceId, accessType, purpose = null, ipAddress = null, userAgent = null) {
    const query = `
      INSERT INTO data_access_audit (user_id, access_type, purpose, ip_address, user_agent, accessed_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP);
    `;

    // Determine the correct ID based on resource type
    let finalQuery = query;
    if (resourceType === 'PATIENT') {
      finalQuery = `
        INSERT INTO data_access_audit (user_id, patient_id, access_type, purpose, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
    } else if (resourceType === 'DISPATCH') {
      finalQuery = `
        INSERT INTO data_access_audit (user_id, dispatch_id, access_type, purpose, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6);
      `;
    }

    await pool.query(finalQuery, [userId, resourceId, accessType, purpose, ipAddress, userAgent]);
  }

  /**
   * Get user's data access history
   */
  static async getDataAccessHistory(userId, limit = 50, offset = 0) {
    const query = `
      SELECT id, patient_id, dispatch_id, access_type, purpose, ip_address, accessed_at
      FROM data_access_audit
      WHERE user_id = $1
      ORDER BY accessed_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * Create API key for user
   */
  static async createApiKey(userId, keyHash, name, permissions) {
    const keyId = uuidv4();

    const query = `
      INSERT INTO api_keys (id, user_id, key_hash, name, permissions)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, permissions, created_at;
    `;

    const result = await pool.query(query, [keyId, userId, keyHash, name, JSON.stringify(permissions)]);
    return result.rows[0];
  }

  /**
   * Get API keys for user
   */
  static async getApiKeys(userId) {
    const query = `
      SELECT id, name, permissions, last_used, is_active, created_at
      FROM api_keys
      WHERE user_id = $1
      ORDER BY created_at DESC;
    `;

    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  /**
   * Revoke API key
   */
  static async revokeApiKey(userId, keyId) {
    const query = `
      UPDATE api_keys
      SET is_active = FALSE
      WHERE id = $1 AND user_id = $2;
    `;

    await pool.query(query, [keyId, userId]);
  }
}

module.exports = UserRepository;

