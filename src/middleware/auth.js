/**
 * Authentication Middleware
 * Handles JWT verification and token extraction
 */

const jwt = require('jsonwebtoken');
const config = require('../config');

class AuthMiddleware {
  /**
   * Verify JWT token
   */
  static verifyToken(req, res, next) {
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        return res.status(401).json({
          error: 'No token provided',
          code: 'NO_TOKEN'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret);
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED',
          expiresAt: error.expiredAt
        });
      }
      
      return res.status(403).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
  }

  /**
   * Extract token from request
   */
  static extractToken(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  }

  /**
   * Optional token verification - doesn't fail if no token
   */
  static optionalToken(req, res, next) {
    try {
      const token = AuthMiddleware.extractToken(req);
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || config.jwt.secret);
        req.user = decoded;
      }
      next();
    } catch (error) {
      // Continue without user
      next();
    }
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload, expiresIn = '1h') {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || config.jwt.secret,
      { expiresIn }
    );
  }

  /**
   * Generate refresh token (longer validity)
   */
  static generateRefreshToken(payload) {
    return jwt.sign(
      payload,
      process.env.JWT_REFRESH_SECRET || config.jwt.refreshSecret,
      { expiresIn: '7d' }
    );
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET || config.jwt.refreshSecret);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}

module.exports = AuthMiddleware;
