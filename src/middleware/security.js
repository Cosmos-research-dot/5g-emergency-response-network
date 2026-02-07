/**
 * Security Middleware
 * Handles rate limiting, HTTP headers, CORS, and input validation
 */

const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');

class SecurityMiddleware {
  /**
   * Apply Helmet for HTTP security headers
   */
  static helmetConfig() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:', 'wss:']
        }
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      frameguard: {
        action: 'deny'
      },
      noSniff: true,
      xssFilter: true
    });
  }

  /**
   * CORS configuration
   */
  static corsConfig() {
    const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173').split(',');
    
    return {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400
    };
  }

  /**
   * General rate limiter (applies to all requests)
   */
  static generalLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
      legacyHeaders: false // Disable the `X-RateLimit-*` headers
    });
  }

  /**
   * Login rate limiter (stricter)
   */
  static loginLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // limit each IP to 5 login attempts per windowMs
      skipSuccessfulRequests: true, // don't count successful requests
      message: 'Too many login attempts, please try again after 15 minutes.',
      store: new rateLimit.MemoryStore()
    });
  }

  /**
   * Auth endpoints rate limiter
   */
  static authLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10, // limit each IP to 10 requests per windowMs
      skipSuccessfulRequests: false,
      message: 'Too many auth requests, please try again later.'
    });
  }

  /**
   * Account lockout after failed attempts
   */
  static accountLockout(maxAttempts = 5, lockoutDuration = 30 * 60 * 1000) {
    const attempts = new Map(); // In production, use Redis

    return {
      recordFailure: (email) => {
        const key = `login_attempts:${email}`;
        const current = attempts.get(key) || { count: 0, lockedUntil: null };
        
        current.count++;
        current.lastAttempt = Date.now();

        if (current.count >= maxAttempts) {
          current.lockedUntil = Date.now() + lockoutDuration;
        }

        attempts.set(key, current);
        return current;
      },

      recordSuccess: (email) => {
        const key = `login_attempts:${email}`;
        attempts.delete(key);
      },

      isLocked: (email) => {
        const key = `login_attempts:${email}`;
        const current = attempts.get(key);
        
        if (!current) return false;
        
        if (current.lockedUntil && current.lockedUntil > Date.now()) {
          return true;
        }

        // Reset if lockout period has passed
        if (current.lockedUntil && current.lockedUntil <= Date.now()) {
          attempts.delete(key);
          return false;
        }

        return false;
      },

      getAttempts: (email) => {
        const key = `login_attempts:${email}`;
        return attempts.get(key) || { count: 0, lockedUntil: null };
      }
    };
  }

  /**
   * Input validation for registration
   */
  static validateRegistration() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
      body('name').notEmpty().trim().escape(),
      body('role').isIn(['DISPATCHER', 'HOSPITAL_ADMIN', 'PARAMEDIC', 'DOCTOR']),
      body('phone').optional().isMobilePhone()
    ];
  }

  /**
   * Input validation for login
   */
  static validateLogin() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('password').notEmpty()
    ];
  }

  /**
   * Input validation for password reset
   */
  static validatePasswordReset() {
    return [
      body('email').isEmail().normalizeEmail(),
      body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
      body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
    ];
  }

  /**
   * Validation error handler
   */
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }
    next();
  }

  /**
   * Request logging middleware
   */
  static requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });

      next();
    };
  }

  /**
   * Sanitize user output (remove sensitive fields)
   */
  static sanitizeUser(user) {
    if (!user) return null;

    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.refreshTokens;
    delete sanitized.resetToken;
    delete sanitized.resetTokenExpires;

    return sanitized;
  }
}

module.exports = SecurityMiddleware;
