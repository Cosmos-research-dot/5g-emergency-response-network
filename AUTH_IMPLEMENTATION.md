# Authentication & Security Implementation Guide
## 5G Emergency Response Network

## Overview

This guide documents the complete authentication and security implementation for the 5G Emergency Response Network. The system includes JWT-based authentication, role-based access control (RBAC), encryption, audit logging, and HIPAA compliance features.

## Quick Start

### 1. Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Generate secure secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('ENCRYPTION_MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Update .env with generated secrets
```

### 2. Database Setup

```bash
# Start PostgreSQL (using docker-compose)
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
# Then run migrations
node src/db/init.js
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
NODE_ENV=production npm start
```

### 4. Test Login

**Demo Credentials (from seeds):**
- Dispatcher: `dispatcher@test.com` / `Password123`
- Hospital Admin: `hospital@test.com` / `Password123`
- Paramedic: `paramedic@test.com` / `Password123`
- Doctor: `doctor@test.com` / `Password123`

## Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Login                                  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Validate Input                                                │
│    - Check email format                                          │
│    - Check password length                                       │
│    - Rate limiting check                                         │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Check Account Status                                          │
│    - Account exists                                              │
│    - Account is active                                           │
│    - Account not locked                                          │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Verify Password                                               │
│    - Compare with bcrypt hash                                    │
│    - Log attempt (success or failure)                            │
│    - Update failed attempt count                                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Generate Tokens                                               │
│    - Access Token (1 hour, JWT)                                  │
│    - Refresh Token (7 days, JWT)                                 │
│    - Store session in database                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Return Tokens to Client                                       │
│    - Send accessToken (short-lived)                              │
│    - Send refreshToken (long-lived)                              │
│    - Return user info                                            │
└─────────────────────────────────────────────────────────────────┘
```

### Protected Route Access

```
Request with Authorization Header
         │
         ▼
┌─────────────────────────────────┐
│ AuthMiddleware.verifyToken()    │
│ - Extract token                 │
│ - Verify JWT signature          │
│ - Check expiration              │
└─────────────────────────────────┘
         │
         ├─ VALID ─────────────────────┐
         │                              │
         │                              ▼
         │              ┌────────────────────────────────┐
         │              │ RBACMiddleware.requireRole()   │
         │              │ - Check user role              │
         │              │ - Verify permissions           │
         │              │ - Log access                    │
         │              └────────────────────────────────┘
         │                              │
         │                              ▼
         │              ┌────────────────────────────────┐
         │              │ Process Request                │
         │              │ - Handle business logic        │
         │              │ - Log data access              │
         │              └────────────────────────────────┘
         │
         └─ INVALID ─────────────────────┐
                                         │
                                         ▼
                              Reject (401/403)
```

## API Endpoints

### Authentication Routes

#### POST /api/auth/register
Register a new user.

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePass123!",
    "name": "New User",
    "role": "DISPATCHER",
    "phone": "+90-123-456-7890"
  }'
```

#### POST /api/auth/login
Login and receive tokens.

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dispatcher@test.com",
    "password": "Password123",
    "rememberMe": true
  }'
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "dispatcher@test.com",
    "name": "Test Dispatcher",
    "role": "DISPATCHER"
  }
}
```

#### POST /api/auth/refresh
Refresh access token.

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

#### POST /api/auth/logout
Logout and revoke tokens.

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### POST /api/auth/password/reset-request
Request password reset.

```bash
curl -X POST http://localhost:3000/api/auth/password/reset-request \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

#### POST /api/auth/password/reset
Reset password with token.

```bash
curl -X POST http://localhost:3000/api/auth/password/reset \
  -H "Content-Type: application/json" \
  -d '{
    "token": "reset-token-from-email",
    "newPassword": "NewSecure123!",
    "confirmPassword": "NewSecure123!"
  }'
```

#### POST /api/auth/password/change
Change password (authenticated users).

```bash
curl -X POST http://localhost:3000/api/auth/password/change \
  -H "Authorization: Bearer {accessToken}" \
  -H "Content-Type: application/json" \
  -d '{
    "oldPassword": "OldPassword123!",
    "newPassword": "NewPassword456!",
    "confirmPassword": "NewPassword456!"
  }'
```

#### GET /api/auth/me
Get current user info.

```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer {accessToken}"
```

#### GET /api/auth/sessions
List active sessions.

```bash
curl http://localhost:3000/api/auth/sessions \
  -H "Authorization: Bearer {accessToken}"
```

#### DELETE /api/auth/sessions/:sessionId
Revoke a specific session.

```bash
curl -X DELETE http://localhost:3000/api/auth/sessions/{sessionId} \
  -H "Authorization: Bearer {accessToken}"
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

```bash
# JWT Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Encryption
ENCRYPTION_MASTER_KEY=your-encryption-key

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Security
HTTPS_ENABLED=false (set to true in production)
RATE_LIMIT_MAX_REQUESTS=100
```

## Frontend Integration

### React Component Usage

```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { user, login, logout, hasPermission } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      
      {hasPermission('ambulances.view') && (
        <AmbulanceList />
      )}

      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

### Protected Routes

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import LoginPage from '@/pages/LoginPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute requiredRoles="DISPATCHER">
              <Dashboard />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
```

## Testing

### Run Authentication Tests

```bash
npm test tests/auth.test.js
```

### Test Coverage

- JWT token generation and validation
- Password hashing and verification
- RBAC permission checking
- Account lockout mechanism
- Input validation
- Data encryption
- HIPAA compliance

### Security Test Cases

```javascript
// Test failed login attempts
POST /api/auth/login (5 times with wrong password)
// Expected: Account locked on 5th attempt

// Test rate limiting
POST /api/auth/login (100 requests in 1 minute)
// Expected: 429 Too Many Requests after 100 requests

// Test token expiration
GET /api/auth/me with expired token
// Expected: 401 Unauthorized

// Test RBAC
GET /api/ambulances with PARAMEDIC role
// Expected: 403 Forbidden (insufficient permissions)
```

## Security Best Practices

### For Developers

1. **Never commit secrets** - Use `.env` files
2. **Always validate input** - Don't trust user input
3. **Use HTTPS in production** - Never HTTP
4. **Rotate secrets regularly** - Every 90 days
5. **Log security events** - For audit trails
6. **Update dependencies** - Run `npm audit` weekly

### For DevOps

1. **Use environment variables** - Not hardcoded secrets
2. **Restrict database access** - Only from app server
3. **Enable CORS properly** - Don't use wildcard
4. **Monitor for attacks** - Check logs regularly
5. **Backup databases** - Daily with encryption
6. **Test disaster recovery** - Quarterly

### For Users

1. **Use strong passwords** - Min 8 chars, mixed case
2. **Enable 2FA** - When available
3. **Never share tokens** - Keep credentials private
4. **Logout when done** - Clear sessions
5. **Report suspicious activity** - Contact admin immediately

## Troubleshooting

### "Invalid token" error

**Problem:** JWT verification fails
**Solution:** 
- Check token hasn't expired
- Verify JWT_SECRET hasn't changed
- Ensure Authorization header format: `Bearer {token}`

### Account locked

**Problem:** Account locked after failed login attempts
**Solution:**
- Wait 30 minutes for auto-unlock
- Or admin can unlock: `UPDATE users SET locked_until = NULL WHERE email = '...';`

### Password reset token invalid

**Problem:** Reset token expired or already used
**Solution:**
- Request new password reset
- Reset tokens expire after 1 hour
- Each reset token can only be used once

### CORS errors

**Problem:** `No 'Access-Control-Allow-Origin' header`
**Solution:**
- Add frontend URL to CORS_ORIGINS
- Format: `http://localhost:3000,https://yourdomain.com`
- Restart server after changing

## Compliance Checklist

- [x] HIPAA audit logging
- [x] GDPR right to deletion
- [x] Encrypted sensitive data
- [x] Password hashing with bcrypt
- [x] JWT token management
- [x] RBAC implementation
- [x] Rate limiting
- [x] Input validation
- [x] Security headers
- [x] Deployment checklist

## Related Documentation

- [SECURITY.md](./SECURITY.md) - Detailed security implementation
- [DEPLOYMENT_SECURITY_CHECKLIST.md](./DEPLOYMENT_SECURITY_CHECKLIST.md) - Pre-deployment checklist
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - Full API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture

## Support & Reporting

For security issues, please:
1. **DO NOT** create public GitHub issues
2. Email: `security@emergency-response.dev`
3. Include: description, reproduction steps, impact

## License

MIT - See LICENSE file for details
