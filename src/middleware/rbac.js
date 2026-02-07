/**
 * Role-Based Access Control (RBAC) Middleware
 * Handles authorization based on user roles and permissions
 */

class RBACMiddleware {
  /**
   * Role hierarchy and permissions mapping
   */
  static ROLES = {
    ADMIN: {
      level: 4,
      permissions: [
        'users.create',
        'users.read',
        'users.update',
        'users.delete',
        'audit.read',
        'audit.export',
        'settings.manage',
        'reports.generate',
        'ambulances.manage',
        'hospitals.manage',
        'dispatches.manage'
      ]
    },
    DISPATCHER: {
      level: 3,
      permissions: [
        'ambulances.view',
        'ambulances.assign',
        'hospitals.view',
        'patients.view',
        'patients.create',
        'dispatches.create',
        'dispatches.read',
        'dispatches.update',
        'vitals.view',
        'reports.view'
      ]
    },
    HOSPITAL_ADMIN: {
      level: 2,
      permissions: [
        'patients.read',
        'patients.update',
        'patients.view_own',
        'beds.manage',
        'hospital.view_own',
        'ambulances.view',
        'dispatches.view',
        'vitals.view',
        'staff.manage_own_hospital'
      ]
    },
    PARAMEDIC: {
      level: 1,
      permissions: [
        'patients.view',
        'patients.update',
        'vitals.create',
        'vitals.update',
        'ambulance.view_assigned',
        'ambulance.update_status',
        'dispatches.view_assigned',
        'dispatches.update'
      ]
    },
    DOCTOR: {
      level: 1,
      permissions: [
        'patients.read',
        'patients.update',
        'vitals.view',
        'dispatches.view',
        'reports.view',
        'treatment.document'
      ]
    }
  };

  /**
   * Check if user has required role
   */
  static requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Check if user has required permission
   */
  static requirePermission(...permissions) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const rolePermissions = RBACMiddleware.ROLES[req.user.role]?.permissions || [];
      const hasPermission = permissions.some(perm => rolePermissions.includes(perm));

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Permission denied',
          code: 'PERMISSION_DENIED',
          required: permissions,
          userRole: req.user.role
        });
      }

      next();
    };
  }

  /**
   * Check resource ownership
   */
  static requireOwnership(resourceType) {
    return (req, res, next) => {
      const userId = req.user?.id;
      const resourceOwnerId = req.params.userId || req.body?.userId;

      // Admins can access any resource
      if (req.user.role === 'ADMIN') {
        return next();
      }

      // Hospital admins can access their hospital's resources
      if (req.user.role === 'HOSPITAL_ADMIN') {
        if (req.user.hospitalId === req.params.hospitalId || req.user.hospitalId === req.body?.hospitalId) {
          return next();
        }
      }

      // Users can only access their own resources
      if (userId === resourceOwnerId) {
        return next();
      }

      return res.status(403).json({
        error: 'Access denied to resource',
        code: 'RESOURCE_OWNERSHIP_DENIED'
      });
    };
  }

  /**
   * Get role level (for hierarchical checks)
   */
  static getRoleLevel(role) {
    return RBACMiddleware.ROLES[role]?.level || 0;
  }

  /**
   * Check if user role is at least the specified level
   */
  static requireRoleLevel(minLevel) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const userLevel = RBACMiddleware.getRoleLevel(req.user.role);
      if (userLevel < minLevel) {
        return res.status(403).json({
          error: 'Insufficient role level',
          code: 'INSUFFICIENT_ROLE_LEVEL',
          required: minLevel,
          current: userLevel
        });
      }

      next();
    };
  }

  /**
   * Get user permissions
   */
  static getUserPermissions(role) {
    return RBACMiddleware.ROLES[role]?.permissions || [];
  }

  /**
   * Check multiple permissions (AND logic)
   */
  static requireAllPermissions(...permissions) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Not authenticated',
          code: 'NOT_AUTHENTICATED'
        });
      }

      const rolePermissions = RBACMiddleware.ROLES[req.user.role]?.permissions || [];
      const hasAllPermissions = permissions.every(perm => rolePermissions.includes(perm));

      if (!hasAllPermissions) {
        return res.status(403).json({
          error: 'Missing required permissions',
          code: 'MISSING_PERMISSIONS',
          required: permissions
        });
      }

      next();
    };
  }
}

module.exports = RBACMiddleware;
