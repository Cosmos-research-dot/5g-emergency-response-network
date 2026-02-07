# Security Implementation Guide - 5G Emergency Response Network

## Table of Contents
1. [Authentication System](#authentication-system)
2. [Role-Based Access Control (RBAC)](#role-based-access-control)
3. [Data Encryption](#data-encryption)
4. [API Security](#api-security)
5. [Audit Logging](#audit-logging)
6. [Compliance & Legal](#compliance--legal)
7. [Deployment Security](#deployment-security)
8. [Incident Response](#incident-response)

---

## Authentication System

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Request:**
```json
{
  "email": "dispatcher@example.com",
  "password": "SecurePassword123!",
  "name": "John Dispatcher",
  "role": "DISPATCHER",
  "phone": "+90-123-456-7890",
  "stationId": "optional-uuid",
  "hospitalId": "optional-uuid"
}
```

**Security Features:**
- Email uniqueness validation
- Password minimum 8 characters required
- Bcrypt hashing with salt rounds: 10
- Email format validation
- Phone number validation

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "dispatcher@example.com",
    "name": "John Dispatcher",
    "role": "DISPATCHER"
  }
}
```

### 2. User Login

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "dispatcher@example.com",
  "password": "SecurePassword123!",
  "rememberMe": true
}
```

**Security Features:**
- Rate limiting: 5 login attempts per 15 minutes
- Account lockout after 5 failed attempts (30 minutes)
- IP address tracking
- User-Agent logging
- JWT token generation with 1-hour expiration

**Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "dispatcher@example.com",
    "name": "John Dispatcher",
    "role": "DISPATCHER"
  }
}
```

**Login Audit Log:**
- Records successful and failed login attempts
- Tracks IP address and user-agent
- Monitors for suspicious patterns
- Locked until timestamp for failed attempts

### 3. Token Management

#### Access Token
- **Type:** JWT
- **Expiration:** 1 hour
- **Payload:**
  ```json
  {
    "id": "user-uuid",
    "email": "user@example.com",
    "role": "DISPATCHER"
  }
  ```

#### Refresh Token
- **Type:** JWT
- **Expiration:** 7 days
- **Used to obtain new access tokens without re-login**

**Endpoint:** `POST /api/auth/refresh`

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Session Tokens
- Stored in database with token hash (SHA-256)
- Tracks multiple sessions per user
- Records IP address, user-agent, creation time
- Can be revoked individually or all at once

**Endpoint:** `GET /api/auth/sessions` - List active sessions
**Endpoint:** `DELETE /api/auth/sessions/:sessionId` - Revoke session

### 4. Password Management

#### Password Reset Request
**Endpoint:** `POST /api/auth/password/reset-request`

```json
{
  "email": "dispatcher@example.com"
}
```

**Security Features:**
- Email verification required
- Reset token expires in 1 hour
- One-time use only
- User informed via email (not yet implemented in demo)

#### Password Reset
**Endpoint:** `POST /api/auth/password/reset`

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

#### Password Change (Authenticated Users)
**Endpoint:** `POST /api/auth/password/change`

**Headers:** `Authorization: Bearer {accessToken}`

```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewSecurePassword123!",
  "confirmPassword": "NewSecurePassword123!"
}
```

**Security Features:**
- Requires current password verification
- Revokes all other sessions (force re-login on other devices)
- Maintains password history (prevent reuse)
- Records change timestamp

### 5. Two-Factor Authentication (2FA) - Optional

**Coming Soon:**
- TOTP (Time-based One-Time Password) using authenticator apps
- SMS-based verification
- Backup codes for account recovery

---

## Role-Based Access Control (RBAC)

### User Roles

#### 1. **ADMIN**
- Full system access
- Permissions: `*` (all)
- Capabilities:
  - Manage all users
  - Access audit logs
  - System configuration
  - Generate reports
  - Delete data (with confirmation)

#### 2. **DISPATCHER**
- Fleet management and dispatch decisions
- Permissions:
  ```
  ambulances.view, ambulances.assign
  dispatches.create, dispatches.read, dispatches.update
  hospitals.view
  patients.view, patients.create
  vitals.view
  reports.view
  ```
- Capabilities:
  - Create emergency dispatches
  - View ambulance locations
  - Assign ambulances to hospitals
  - Monitor patient vitals
  - Access traffic/routing information

#### 3. **HOSPITAL_ADMIN**
- Patient monitoring and bed management
- Permissions:
  ```
  patients.read, patients.update, patients.view_own
  beds.manage
  hospital.view_own
  ambulances.view
  dispatches.view
  vitals.view
  staff.manage_own_hospital
  ```
- Capabilities:
  - Manage hospital beds and resources
  - View incoming ambulances
  - Update patient information
  - Manage hospital staff
  - View hospital-specific dispatches

#### 4. **PARAMEDIC**
- Field operations and patient updates
- Permissions:
  ```
  patients.view, patients.update
  vitals.create, vitals.update
  ambulance.view_assigned
  ambulance.update_status
  dispatches.view_assigned, dispatches.update
  ```
- Capabilities:
  - Update patient vital signs
  - Record patient observations
  - Update ambulance status
  - Send location updates
  - Communicate with hospital

#### 5. **DOCTOR**
- Patient review and treatment decisions
- Permissions:
  ```
  patients.read, patients.update
  vitals.view
  dispatches.view
  reports.view
  treatment.document
  ```
- Capabilities:
  - Review patient medical history
  - Monitor vital signs
  - Document treatment decisions
  - Access medical reports

### Permission Checking

**Backend Middleware:**
```javascript
router.get('/patients/:id', 
  AuthMiddleware.verifyToken,
  RBACMiddleware.requirePermission('patients.read'),
  PatientController.getPatient
);
```

**Frontend:**
```typescript
{user.hasPermission('patients.read') && (
  <PatientList />
)}
```

### Resource Ownership

- Hospitals can only access their own ambulances and patients
- Paramedics can only view assigned ambulances
- Doctors can access patients assigned to their hospital
- Admins can access all resources

---

## Data Encryption

### 1. In-Transit Encryption (HTTPS/TLS)

**Requirements:**
- All API endpoints must use HTTPS
- TLS 1.2 or higher
- Strong cipher suites (AES-256, ChaCha20)

**Nginx Configuration:**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

### 2. At-Rest Encryption

**Sensitive Fields to Encrypt:**
- Patient SSN/ID numbers
- Patient phone numbers
- Patient addresses
- Patient email addresses
- Emergency contact information
- Medical allergies and conditions

**Encryption Method:**
- Algorithm: AES-256-GCM
- Key Management: Environment variable (ENCRYPTION_MASTER_KEY)
- IV: 12 bytes (randomized for each encryption)
- Authentication