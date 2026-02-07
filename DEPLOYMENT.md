# 5G Emergency Response Network - Deployment Guide

## Local Development Setup

### Prerequisites
- Node.js v14+ (tested with v22.22.0)
- npm v6+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/cosmos-research-dot/5g-emergency-response-network.git
cd 5g-emergency-response-network

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

### Development Mode (with auto-reload)

```bash
npm run dev
```

---

## Production Deployment

### Docker Deployment

#### Build Docker Image

```bash
docker build -t 5g-ern:latest .
```

#### Run Container

```bash
docker run -d \
  --name 5g-ern \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  5g-ern:latest
```

#### Docker Compose

```bash
docker-compose up -d
```

---

## Cloud Deployment

### AWS EC2

```bash
# Connect to instance
ssh -i key.pem ec2-user@your-instance-ip

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Clone and setup
git clone https://github.com/cosmos-research-dot/5g-emergency-response-network.git
cd 5g-emergency-response-network
npm install

# Start with PM2
npm install -g pm2
pm2 start src/server.js --name "5g-ern"
pm2 save
pm2 startup
```

### Heroku

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login and deploy
heroku login
heroku create your-app-name
git push heroku main
heroku open
```

### Google Cloud Platform

```bash
# Deploy to Cloud Run
gcloud run deploy 5g-ern \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

---

## Configuration

### Environment Variables

Create `.env` file:

```
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
WS_PORT=3001
DEBUG=false
```

### Network Configuration

See `src/config.js` for 5G network parameters:
- Latency profiles (5G vs 4G)
- Bandwidth allocation
- Network slicing percentages
- Geographic bounds and hospital data

---

## Monitoring & Logs

### Health Check

```bash
curl http://localhost:3000/api/health
```

### System Status

```bash
curl http://localhost:3000/api/status
```

### View Logs

```bash
# PM2
pm2 logs 5g-ern

# Docker
docker logs 5g-ern

# Node
journalctl -u node-app -f
```

---

## Performance Tuning

### Cluster Mode (PM2)

```bash
pm2 start src/server.js -i max --name "5g-ern"
```

### Load Balancing

Use NGINX as reverse proxy:

```nginx
upstream 5g_ern {
  server localhost:3000;
  server localhost:3001;
  server localhost:3002;
}

server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://5g_ern;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
  }

  location /ws {
    proxy_pass http://5g_ern;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'Upgrade';
  }
}
```

---

## Backup & Recovery

### Database Backup (if using MongoDB)

```bash
mongodump --out ./backup
```

### Code Backup

```bash
git backup create my-backup
```

---

## Troubleshooting

### WebSocket Connection Issues

Check firewall allows port 3000/3001

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
```

### High Memory Usage

```bash
# Check memory
pm2 monit

# Increase Node memory limit
node --max-old-space-size=4096 src/server.js
```

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

---

## Security Checklist

- [ ] Enable HTTPS/TLS (use Let's Encrypt)
- [ ] Add authentication (JWT tokens)
- [ ] Set CORS properly
- [ ] Validate all inputs
- [ ] Use environment variables for secrets
- [ ] Enable rate limiting
- [ ] Set up WAF (Web Application Firewall)
- [ ] Regular security audits
- [ ] Keep dependencies updated

---

## Scaling Considerations

For production with 1000+ concurrent ambulances:

1. **Database**: Move to MongoDB/PostgreSQL cluster
2. **Caching**: Add Redis for vitals caching
3. **WebSocket**: Use Socket.io with adapter
4. **Load Balancer**: AWS ALB or NGINX
5. **CDN**: CloudFlare or AWS CloudFront
6. **Monitoring**: ELK stack or CloudWatch
7. **Containerization**: Kubernetes orchestration

---

## Support

For issues, open GitHub issues or contact the team.
