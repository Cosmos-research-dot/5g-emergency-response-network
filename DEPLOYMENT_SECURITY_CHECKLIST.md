# Deployment Security Checklist
## 5G Emergency Response Network - Production Deployment

Use this checklist before deploying to production to ensure all security measures are in place.

---

## 1. Environment & Configuration ✓

- [ ] **Change all default secrets**
  - [ ] `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - [ ] `JWT_REFRESH_SECRET` - Generate new random secret
  - [ ] `ENCRYPTION_MASTER_KEY` - Generate new random key
  - [ ] `DB_PASSWORD` - Use strong password (min 12 chars, mixed case, numbers, symbols)

- [ ] **Set `NODE_ENV=production`**

- [ ] **Configure CORS origins**
  - [ ] Set `CORS_ORIGINS` to only trusted domains
  - [ ] Do NOT use wildcard (`*`) in production
  - Example: `https://app.yourdomain.com,https://admin.yourdomain.com`

- [ ] **Enable HTTPS/TLS**
  - [ ] Set `HTTPS_ENABLED=true`
  - [ ] Obtain SSL certificate (Let's Encrypt or commercial CA)
  - [ ] Configure `SSL_CERT_PATH` and `SSL_KEY_PATH`
  - [ ] Use TLS 1.2 or higher

- [ ] **Database Configuration**
  - [ ] Set `DB_SSL=true` for production databases
  - [ ] Use separate DB user with limited permissions
  - [ ] Enable database backups with encryption

---

## 2. API Security ✓

- [ ] **Rate Limiting**
  - [ ] Verified rate limits are enforced
  - [ ] Test with tool: `ab -n 1000 -c 100 http://api.example.com/api/auth/login`
  - [ ] Monitor for DOS attacks

- [ ] **Authentication Middleware**
  - [ ] All protected endpoints require `Authorization: Bearer {token}` header
  - [ ] JWT verification is active on all protected routes
  - [ ] Token expiration is enforced (1 hour for access token)

- [ ] **Input Validation**
  - [ ] All user inputs are validated
  - [ ] Email format validation active
  - [ ] Password strength requirements enforced
  - [ ] SQL injection protection verified

- [ ] **Security Headers (Helmet.js)**
  - [ ] `Content-Security-Policy` configured
  - [ ] `X-Frame-Options: DENY` set
  - [ ] `X-Content-Type-Options: nosniff` set
  - [ ] `Strict-Transport-Security` configured
  - [ ] `X-XSS-Protection` enabled

---

## 3. Database Security ✓

- [ ] **PostgreSQL Security**
  - [ ] Non-default port configured (not 5432 if exposed)
  - [ ] Password authentication enforced
  - [ ] SSL/TLS connections required
  - [ ] Remote connections restricted to app server only

- [ ] **Database User Permissions**
  - [ ] App user has minimal required permissions
  - [ ] Separate read-only user for reporting
  - [ ] Admin user password changed from default
  - [ ] No superuser account used for app connections

- [ ] **Data Backup & Recovery**
  - [ ] Automated daily backups configured
  - [ ] Backups encrypted at rest
  - [ ] Backup location is remote (not on same server)
  - [ ] Recovery procedures tested
  - [ ] Retention policy defined (typically 30 days)

- [ ] **Database Activity Monitoring**
  - [ ] Query logging enabled
  - [ ] Slow query logging configured
  - [ ] Failed login attempts logged

---

## 4. Data Encryption ✓

- [ ] **In-Transit Encryption**
  - [ ] All API endpoints use HTTPS
  - [ ] WebSocket connections use WSS (secure)
  - [ ] TLS certificate is valid and not self-signed
  - [ ] Certificate chain is complete

- [ ] **At-Rest Encryption**
  - [ ] Sensitive fields encrypted: SSN, phone, address, etc.
  - [ ] Encryption key securely stored in environment variable
  - [ ] Database backups are encrypted
  - [ ] Log files don't contain sensitive data

- [ ] **Key Management**
  - [ ] Encryption key is not in source code
  - [ ] Key rotation procedure documented
  - [ ] Only authorized personnel can access keys
  - [ ] Key backup stored securely offline

---

## 5. User Authentication ✓

- [ ] **Password Security**
  - [ ] Bcrypt hashing with salt rounds: 10
  - [ ] Password reset tokens expire in 1 hour
  - [ ] Password reset tokens are one-time use
  - [ ] Passwords are minimum 8 characters
  - [ ] No password hints or recovery questions

- [ ] **Account Lockout**
  - [ ] Lockout after 5 failed login attempts
  - [ ] Lockout duration: 30 minutes
  - [ ] Failed attempts logged
  - [ ] Admin can manually unlock accounts

- [ ] **Session Management**
  - [ ] Sessions stored in database with expiration
  - [ ] Sessions can be revoked individually
  - [ ] Logout clears tokens
  - [ ] Session hijacking monitoring enabled
  - [ ] IP address changes trigger re-authentication

- [ ] **Two-Factor Authentication (2FA)**
  - [ ] 2FA enabled for admin accounts
  - [ ] TOTP-based (authenticator apps)
  - [ ] Backup codes generated and stored securely
  - [ ] Recovery procedure documented

---

## 6. Authorization & RBAC ✓

- [ ] **Role-Based Access Control**
  - [ ] 5 roles defined: ADMIN, DISPATCHER, HOSPITAL_ADMIN, PARAMEDIC, DOCTOR
  - [ ] Role permissions properly restricted
  - [ ] Resource ownership enforced
  - [ ] Cross-hospital access prevented

- [ ] **Permission Verification**
  - [ ] Permissions checked on every protected endpoint
  - [ ] Middleware enforces authorization
  - [ ] Test with insufficient permissions account
  - [ ] Denial of access logged

---

## 7. Audit Logging & Monitoring ✓

- [ ] **Audit Logs**
  - [ ] All user actions logged (login, logout, create, update, delete)
  - [ ] Audit log table has data access tracking
  - [ ] Logs are immutable (not deletable)
  - [ ] Logs include: user ID, timestamp, action, IP address, result
  - [ ] Sensitive data not stored in logs

- [ ] **Login Audit Trail**
  - [ ] Successful logins recorded
  - [ ] Failed logins recorded with reason
  - [ ] Account lockouts logged
  - [ ] Password resets logged
  - [ ] All logins include IP and user-agent

- [ ] **Data Access Audit (HIPAA)**
  - [ ] Patient record access logged
  - [ ] Dispatch access tracked
  - [ ] Access audit includes purpose
  - [ ] Access audit is searchable and exportable

- [ ] **Monitoring & Alerting**
  - [ ] Failed login rate monitored
  - [ ] Unusual access patterns detected
  - [ ] Database errors logged and alerted
  - [ ] API error rates monitored
  - [ ] Email alerts configured for critical events

---

## 8. Infrastructure Security ✓

- [ ] **Server Hardening**
  - [ ] OS security patches applied
  - [ ] Firewall configured (restrict ports)
  - [ ] SSH key-based authentication only (no passwords)
  - [ ] Failed SSH login attempts limited
  - [ ] Root login disabled

- [ ] **Docker Security** (if containerized)
  - [ ] Base image is minimal (alpine, distroless)
  - [ ] No hardcoded secrets in Dockerfile
  - [ ] Non-root user running app
  - [ ] Resource limits set (CPU, memory)
  - [ ] Read-only filesystem where possible
  - [ ] Container images scanned for vulnerabilities

- [ ] **Network Security**
  - [ ] API only accessible via HTTPS
  - [ ] Database only accessible from app server
  - [ ] WebSocket connections secured (WSS)
  - [ ] DDoS protection in place
  - [ ] WAF (Web Application Firewall) configured

---

## 9. Compliance & Legal ✓

- [ ] **HIPAA Compliance**
  - [ ] Business Associate Agreement (BAA) signed
  - [ ] Privacy Impact Assessment completed
  - [ ] Security Risk Analysis completed
  - [ ] Breach notification plan documented
  - [ ] Patient consent forms reviewed
  - [ ] All access is HIPAA audit-logged

- [ ] **GDPR Compliance** (if serving EU users)
  - [ ] Privacy Policy published
  - [ ] Right to access implemented
  - [ ] Right to deletion (right to be forgotten) implemented
  - [ ] Data Processing Agreement in place
  - [ ] Consent mechanism for data collection
  - [ ] Data portability implemented

- [ ] **Data Protection**
  - [ ] Data retention policy defined
  - [ ] Automatic data deletion after retention period
  - [ ] Encryption key for deleted data destroyed
  - [ ] Data classification implemented

---

## 10. Incident Response & Security ✓

- [ ] **Incident Response Plan**
  - [ ] Documented and reviewed
  - [ ] Contact list updated
  - [ ] Response procedures tested
  - [ ] Recovery procedures documented
  - [ ] Post-breach analysis process defined

- [ ] **Secret Management**
  - [ ] No secrets in Git repository
  - [ ] `.env` files in `.gitignore`
  - [ ] Secrets management tool in use (Vault, AWS Secrets Manager, etc.)
  - [ ] Secret rotation schedule defined
  - [ ] Old secrets retired

- [ ] **Vulnerability Management**
  - [ ] Dependencies scanned for vulnerabilities
  - [ ] npm audit run: `npm audit --production`
  - [ ] Critical vulnerabilities patched
  - [ ] Security updates monitored
  - [ ] Patch management process defined

---

## 11. Testing & Validation ✓

- [ ] **Security Testing**
  - [ ] OWASP Top 10 vulnerabilities tested
  - [ ] SQL injection tests passed
  - [ ] XSS prevention verified
  - [ ] CSRF tokens validated
  - [ ] Authorization tests passed

- [ ] **Load Testing**
  - [ ] Performance baseline established
  - [ ] Rate limiting tested and effective
  - [ ] High-load scenarios tested
  - [ ] Recovery procedures validated

- [ ] **Penetration Testing** (Recommended)
  - [ ] Third-party pen test conducted
  - [ ] All findings addressed
  - [ ] Fix verification completed
  - [ ] Report archived

---

## 12. Documentation ✓

- [ ] **Security Documentation**
  - [ ] Architecture diagram reviewed
  - [ ] Authentication flow documented
  - [ ] Authorization rules documented
  - [ ] Disaster recovery plan documented
  - [ ] Incident response procedures documented

- [ ] **Runbooks**
  - [ ] Password reset procedure
  - [ ] Account lockout procedure
  - [ ] Emergency access procedure
  - [ ] Data breach notification procedure
  - [ ] Service restoration procedure

---

## 13. Staff Training & Access ✓

- [ ] **Staff Training**
  - [ ] Security training completed for all staff
  - [ ] HIPAA training completed (if applicable)
  - [ ] Password handling procedures understood
  - [ ] Incident reporting procedure understood

- [ ] **Access Control**
  - [ ] Only authorized personnel have admin access
  - [ ] SSH keys managed securely
  - [ ] VPN access for remote workers
  - [ ] Logging into production documented and audited
  - [ ] Access removal on staff departure

---

## 14. Post-Deployment ✓

- [ ] **Monitoring**
  - [ ] Application health checks running
  - [ ] Error rate monitoring active
  - [ ] Database health checks active
  - [ ] Uptime monitoring in place
  - [ ] Alert recipients configured

- [ ] **Regular Security Reviews**
  - [ ] Monthly security log review scheduled
  - [ ] Quarterly penetration testing scheduled
  - [ ] Annual security assessment scheduled
  - [ ] Dependency updates reviewed weekly
  - [ ] Access rights reviewed quarterly

- [ ] **Disaster Recovery**
  - [ ] Backup restoration tested
  - [ ] RTO (Recovery Time Objective) defined
  - [ ] RPO (Recovery Point Objective) defined
  - [ ] Failover procedures tested
  - [ ] Communication plan during incidents

---

## Sign-Off

- [ ] **Security Officer**: _________________ Date: _______
- [ ] **System Administrator**: _________________ Date: _______
- [ ] **Compliance Officer**: _________________ Date: _______

---

## Notes

Any security checks that cannot be completed should have risk acceptance signed by appropriate personnel.

**Critical Issues Found:** ___________________________________________________________

**Approval for Production Deployment:** YES [ ] NO [ ]

---

**Last Updated:** 2026-02-07
**Next Review:** 2026-05-07 (Quarterly)
