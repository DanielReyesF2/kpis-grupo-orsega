# Railway Healthcheck Configuration

## Overview
Your application has been configured with comprehensive healthcheck endpoints for Railway deployment with zero-downtime deployments.

## Healthcheck Endpoints

### Primary Healthcheck: `/api/health`
- **Status**: Returns 200 for healthy/degraded, 503 for unhealthy
- **Checks**: Database connectivity, OpenAI API, SendGrid configuration
- **Response**: Detailed health status with service status and metrics
- **Railway Configuration**: Set as `healthcheckPath` in `railway.json`

### Readiness Check: `/api/health/ready`
- **Status**: Returns 200 when ready, 503 when not ready
- **Checks**: Database availability only
- **Use Case**: Kubernetes-style readiness probe

### Liveness Check: `/api/health/live`
- **Status**: Always returns 200
- **Checks**: Basic application liveness
- **Use Case**: Kubernetes-style liveness probe

## Railway Configuration

### `railway.json` Settings
```json
{
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Key Configuration Details
- **Healthcheck Path**: `/api/health` - Comprehensive health monitoring
- **Timeout**: 300 seconds (5 minutes) - Sufficient for database checks
- **Port**: Application listens on `process.env.PORT` (Railway's injected port)
- **Hostname**: Railway uses `healthcheck.railway.app` for healthcheck requests

## Health Status Levels

### Healthy (200)
- Database: Connected
- All services: Available or properly configured

### Degraded (200)
- Database: Connected
- Some optional services: Not configured (OpenAI, SendGrid)

### Unhealthy (503)
- Database: Disconnected
- Critical services: Failed

## Deployment Process

1. **Railway starts new deployment**
2. **Healthcheck begins**: Railway calls `/api/health` every few seconds
3. **Database check**: Verifies PostgreSQL connectivity
4. **Service verification**: Checks optional service configurations
5. **Traffic switch**: Only when healthcheck returns 200 status
6. **Old deployment**: Terminated after successful traffic switch

## Monitoring

### Healthcheck Response Example
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T20:03:11.384Z",
  "services": {
    "database": "up",
    "openai": "up", 
    "sendgrid": "up"
  },
  "metrics": {
    "uptime": 9086.1023375,
    "memoryUsage": {...},
    "version": "1.0.0"
  }
}
```

### Logging
- All healthcheck requests are logged with response times
- Failed healthchecks include error details
- Service status changes are tracked

## Troubleshooting

### Common Issues
1. **Service Unavailable**: Check if application listens on Railway's PORT
2. **Timeout**: Increase `healthcheckTimeout` if database queries are slow
3. **400 Status**: Ensure application accepts requests from `healthcheck.railway.app`

### Debug Commands
```bash
# Test healthcheck locally
curl http://localhost:8080/api/health

# Test readiness
curl http://localhost:8080/api/health/ready

# Test liveness  
curl http://localhost:8080/api/health/live
```

## Security Notes
- Healthcheck endpoints are public (no authentication required)
- Sensitive data is redacted from logs
- Security headers are applied to all responses
- Rate limiting protects against abuse

## Zero-Downtime Deployment
With this configuration, Railway will:
1. Deploy new version alongside existing version
2. Run healthchecks on new version
3. Switch traffic only when new version is healthy
4. Terminate old version after successful switch
5. Ensure continuous service availability
