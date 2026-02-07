/**
 * Authentication Routes
 * Handles user registration, login, logout, token refresh, and password reset
 */

const express = require('express');
const crypto = require('crypto');
const AuthMiddleware = require('../middleware/auth');
const RBACMiddleware = require('../middleware/rbac');
const SecurityMiddleware = require('../middleware/security');
const UserRepository = require('../db/repositories/user-repo');

const router = express.Router();

// Security middleware instances
let loginAttempts; // Will be injected

/**
 * POST /auth/register
 * Register a new user
 */
router.post(
  '/register',
  SecurityMiddleware.validateRegistration(),
  SecurityMiddleware.handleValidationErrors,
  async (req, res) => {
    try {
      const { email, password, name, role, phone, stationId, hospitalId } = req.body;

      // Check if user already exists
      const existingUser = await UserRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          code: 'USER_EXISTS'
        });
      }

      // Create user
      const user = await UserRepository.create({
        email,
        password,
        name,
        role,
        phone,
        stationId,
        hospitalId
      });

      // Log the registration in audit log
      await logAuditAction(null, 'USER_REGISTERED', 'USER', user.id, null, { email, role });

      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * POST /auth/login
 * Login user and return JWT token
 */
router.post(
  '/login',
  SecurityMiddleware.validateLogin(),
  SecurityMiddleware.handleValidationErrors,
  SecurityMiddleware.loginLimiter(),
  async (req, res) => {
    try {
      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');

      // Check if account is locked
      if (loginAttempts && loginAttempts.isLocked(email)) {
        const attempts = loginAttempts.getAttempts(email);
        return res.status(429).json({
          error: 'Account is temporarily locked due to too many failed login attempts',
          code: 'ACCOUNT_LOCKED',
          lockedUntil: attempts.lockedUntil
        });
      }

      // Find user
      const user = await UserRepository.findByEmail(email);
      if (!user) {
        if (loginAttempts) {
          loginAttempts.recordFailure(email);
        }
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          error: 'User account is inactive',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Verify password
      const isPasswordValid = await UserRepository.verifyPassword(user.id, password);
      if (!isPasswordValid) {
        if (loginAttempts) {
          const result = loginAttempts.recordFailure(email);
          if (result.locked) {
            return res.status(429).json({
              error: 'Account locked due to too many failed attempts',
              code: 'ACCOUNT_LOCKED'
            });
          }
        }
        return res.status(401).json({
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Clear failed attempts on successful login
      if (loginAttempts) {
        loginAttempts.recordSuccess(email);
      }
      await UserRepository.clearFailedAttempts(user.id);

      // Update last login
      await UserRepository.updateLastLogin(user.id, ipAddress, userAgent);

      // Log successful login
      await UserRepository.logLogin(user.id, email, 'SUCCESS', null, ipAddress, userAgent);

      // Generate tokens
      const accessToken = AuthMiddleware.generateToken(
        { id: user.id, email: user.email, role: user.role },
        '1h'
      );

      const refreshToken = AuthMiddleware.generateRefreshToken(
        { id: user.id, email: user.email }
      );

      // Hash tokens for storage
      const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      // Store session
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await UserRepository.storeSessionToken(
        user.id,
        tokenHash,
        refreshTokenHash,
        expiresAt,
        ipAddress,
        userAgent
      );

      res.json({
        message: 'Login successful',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = AuthMiddleware.verifyRefreshToken(refreshToken);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Get user
    const user = await UserRepository.findById(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new access token
    const newAccessToken = AuthMiddleware.generateToken(
      { id: user.id, email: user.email, role: user.role },
      '1h'
    );

    res.json({
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

/**
 * POST /auth/logout
 * Logout user and revoke tokens
 */
router.post('/logout', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (sessionId) {
      // Revoke specific session
      await UserRepository.revokeSession(userId, sessionId);
    } else {
      // Revoke all sessions
      await UserRepository.revokeAllSessions(userId);
    }

    // Log logout
    await logAuditAction(userId, 'USER_LOGOUT', 'SESSION', sessionId, null, null);

    res.json({
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

/**
 * POST /auth/password/reset-request
 * Request password reset (sends email)
 */
router.post(
  '/password/reset-request',
  SecurityMiddleware.validateLogin(),
  SecurityMiddleware.handleValidationErrors,
  async (req, res) => {
    try {
      const { email } = req.body;

      // Find user
      const user = await UserRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return res.json({
          message: 'If the email exists in our system, a password reset link will be sent'
        });
      }

      // Create reset token
      const resetToken = await UserRepository.createPasswordResetToken(user.id);

      // In production, send email with reset token
      // For now, just log it
      console.log(`Password reset token for ${email}: ${resetToken.id}`);

      // Log the request
      await logAuditAction(user.id, 'PASSWORD_RESET_REQUESTED', 'USER', user.id, null, null);

      res.json({
        message: 'If the email exists in our system, a password reset link will be sent'
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({
        error: 'Password reset request failed',
        code: 'RESET_REQUEST_ERROR'
      });
    }
  }
);

/**
 * POST /auth/password/reset
 * Complete password reset with token
 */
router.post(
  '/password/reset',
  SecurityMiddleware.validatePasswordReset(),
  SecurityMiddleware.handleValidationErrors,
  async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      // Verify reset token
      const resetToken = await UserRepository.verifyPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({
          error: 'Invalid or expired reset token',
          code: 'INVALID_RESET_TOKEN'
        });
      }

      // Reset password
      const user = await UserRepository.resetPassword(resetToken.user_id, newPassword);

      // Mark token as used
      await UserRepository.usePasswordResetToken(token);

      // Revoke all sessions (user must login again)
      await UserRepository.revokeAllSessions(resetToken.user_id);

      // Log the password reset
      await logAuditAction(resetToken.user_id, 'PASSWORD_RESET', 'USER', resetToken.user_id, null, null);

      res.json({
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({
        error: 'Password reset failed',
        code: 'RESET_ERROR'
      });
    }
  }
);

/**
 * POST /auth/password/change
 * Change password (requires current password)
 */
router.post(
  '/password/change',
  AuthMiddleware.verifyToken,
  SecurityMiddleware.validatePasswordReset(),
  SecurityMiddleware.handleValidationErrors,
  async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user.id;

      // Change password
      await UserRepository.changePassword(userId, oldPassword, newPassword);

      // Revoke all other sessions
      const sessions = await UserRepository.getActiveSessions(userId);
      for (const session of sessions) {
        // Keep only current session
        if (session.id !== req.session?.id) {
          await UserRepository.revokeSession(userId, session.id);
        }
      }

      // Log the change
      await logAuditAction(userId, 'PASSWORD_CHANGED', 'USER', userId, null, null);

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      if (error.message === 'Invalid current password') {
        return res.status(401).json({
          error: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        });
      }

      console.error('Password change error:', error);
      res.status(500).json({
        error: 'Password change failed',
        code: 'CHANGE_ERROR'
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    const user = await UserRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        lastLogin: user.last_login,
        twoFactorEnabled: user.two_factor_enabled
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Failed to get user info',
      code: 'GET_USER_ERROR'
    });
  }
});

/**
 * GET /auth/sessions
 * Get active sessions
 */
router.get('/sessions', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    const sessions = await UserRepository.getActiveSessions(req.user.id);
    res.json({ sessions });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to get sessions',
      code: 'GET_SESSIONS_ERROR'
    });
  }
});

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', AuthMiddleware.verifyToken, async (req, res) => {
  try {
    await UserRepository.revokeSession(req.user.id, req.params.sessionId);
    res.json({ message: 'Session revoked' });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      code: 'REVOKE_SESSION_ERROR'
    });
  }
});

/**
 * Helper function to log audit actions
 */
async function logAuditAction(userId, action, resourceType, resourceId, oldValues, newValues) {
  try {
    // TODO: Implement audit logging
    console.log(`[AUDIT] ${action} - User: ${userId}, Resource: ${resourceType}:${resourceId}`);
  } catch (error) {
    console.error('Audit logging error:', error);
  }
}

/**
 * Initialize routes with dependencies
 */
function initializeRoutes(dependencies) {
  loginAttempts = dependencies.loginAttempts;
}

module.exports = { router, initializeRoutes };
