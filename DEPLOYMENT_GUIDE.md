## Deployment & Configuration Guide

### 🌐 **Vercel Deployment**

#### Prerequisites
1. Vercel account (vercel.com)
2. GitHub repository connected to Vercel
3. MongoDB Atlas cluster (cloud database)
4. SMTP credentials (for email notifications)

#### Environment Variables on Vercel

Set these in your Vercel project settings (**Settings > Environment Variables**):

```
MONGODB_URI = mongodb+srv://username:password@cluster.mongodb.net/payroll
JWT_SECRET = your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET = your-refresh-token-secret-min-32-chars
BIOMETRIC_API_KEY = your-biometric-api-key-or-empty
ALLOWED_ORIGINS = https://yourdomain.com,http://localhost:3000
NODE_ENV = production
SMTP_HOST = smtp.gmail.com (or your SMTP provider)
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASSWORD = your-app-specific-password
```

#### Deploy Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add appraisal and HR integration systems"
   git push origin main
   ```

2. **Vercel auto-deploys** (configured via webhook)
   - Monitor deployment: https://vercel.com/dashboard

3. **Verify deployment**
   ```bash
   curl https://your-vercel-app.vercel.app/api/hr/candidates
   ```

4. **Test with real data**
   - Create test company
   - Create test employees
   - Run appraisal cycle

---

### 🗄️ **MongoDB Setup**

#### Create MongoDB Cluster

1. Go to **MongoDB Atlas** (mongodb.com/cloud/atlas)
2. Create free cluster (M0 tier is free)
3. Add user: 
   - Username: `payroll_user`
   - Password: (generate secure password)
4. Get connection string:
   ```
   mongodb+srv://payroll_user:PASSWORD@cluster.mongodb.net/payroll?retryWrites=true
   ```

#### Database Structure

The system creates these collections automatically:
- `users` - System users
- `companies` - Company records
- `employees` - Employee data
- `appraisals` - Performance appraisals
- `appraisalcycles` - Evaluation periods
- `appraisaltemplates` - Rating templates
- `payrollrecords` - Payroll calculations
- `attendance` - Attendance records
- `leaves` - Leave requests
- `leavebalances` - Leave balances
- `shifts` - Shift definitions
- Plus 10+ more...

---

### ✉️ **Email Configuration (Optional)**

#### Gmail Setup for Notifications

1. Enable 2-factor authentication
2. Generate App Password:
   - Go to https://myaccount.google.com/apppasswords
   - Select app: Mail
   - Select device: Windows
   - Copy the 16-character password

3. Set environment variables:
   ```
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = your-email@gmail.com
   SMTP_PASSWORD = 16-char-app-password
   ```

#### Alternative: SendGrid

```
SMTP_HOST = smtp.sendgrid.net
SMTP_PORT = 587
SMTP_USER = apikey
SMTP_PASSWORD = SG.your-sendgrid-api-key
```

---

### 🔐 **Security Checklist**

- [ ] Generate strong JWT secrets (min 32 characters)
- [ ] Set ALLOWED_ORIGINS to your domain only
- [ ] Enable MongoDB IP whitelist
- [ ] Use HTTPS only (Vercel provides SSL)
- [ ] Rotate secrets every 90 days
- [ ] Enable 2FA on Vercel & MongoDB accounts
- [ ] Regular database backups (MongoDB Atlas automatic)
- [ ] Monitor error logs daily
- [ ] Set up rate limiting for APIs

---

### 📊 **Performance Optimization**

#### Database Indexes (Already Created)

```javascript
// AppraisalCycle
db.appraisalcycles.createIndex({ companyId: 1, status: 1 })

// AppraisalTemplate  
db.appraisaltemplates.createIndex({ companyId: 1, isActive: 1 })

// Appraisal
db.appraisals.createIndex({ employeeId: 1, cycleId: 1 }, { unique: true })
db.appraisals.createIndex({ cycleId: 1, status: 1 })
```

#### Caching Strategy

- Cache company settings in memory (refresh every 1 hour)
- Cache templates after first load
- Use ETags for list endpoints
- Implement pagination (default: 20 items per page)

#### Monitoring

- Monitor MongoDB query performance
- Set up Vercel analytics
- Track API response times
- Alert on errors > 5% rate

---

### 🚀 **Local Development Setup**

#### Prerequisites
- Node.js 18+
- MongoDB local or Atlas
- Git

#### Installation

```bash
# Clone repository
git clone <repo-url>
cd payroll-fixed

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/payroll
JWT_SECRET=dev-secret-key-min-32-chars-long
JWT_REFRESH_SECRET=dev-refresh-secret-key-min-32
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
BIOMETRIC_API_KEY=test-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=test@gmail.com
SMTP_PASSWORD=test-password
EOF

# Start server
npm start

# Open browser
# API: http://localhost:3000/api
# Frontend: http://localhost:3000
```

#### Testing

```bash
# Run test suite
npm test

# Run appraisal API tests
node APPRAISAL_API_TESTS.js

# Watch mode
npm run test:watch
```

---

### 📈 **API Rate Limits (Recommended)**

```javascript
// Implement in production
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // 100 requests per window
  message: 'Too many requests, please try again later'
}));

// Stricter limit for auth endpoints
app.post('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,                     // 5 login attempts per 15 min
  skipSuccessfulRequests: true
}));
```

---

### 🔄 **Backup & Recovery**

#### MongoDB Backup

MongoDB Atlas provides:
- Automatic daily backups (M0 tier: 7 days retention)
- Point-in-time recovery for paid tiers
- Manual backup download

#### File Backups

Store these in version control:
- `.env` (separately, not in git)
- `vercel.json`
- All source code
- Configuration files

#### Disaster Recovery Plan

1. **Database**: Atlas backup restore (24 hours)
2. **Application**: Redeploy from GitHub (5 minutes)
3. **Static files**: Cached on Vercel CDN
4. **RTO**: 30 minutes
5. **RPO**: 24 hours (latest backup)

---

### 📊 **Monitoring & Alerts**

#### Key Metrics to Monitor

1. **API Response Time**: Target < 500ms
2. **Error Rate**: Target < 1%
3. **Database Connections**: Warn if > 90% utilized
4. **Server Memory**: Warn if > 80% used
5. **Request Rate**: Track for capacity planning

#### Setup Monitoring

```bash
# Using Vercel Analytics (built-in)
- View at https://vercel.com/dashboard

# Using MongoDB Atlas Monitoring
- View charts in MongoDB Cloud Console

# Using third-party (optional)
- New Relic
- Datadog
- LogRocket
```

---

### 🧹 **Maintenance Tasks**

#### Daily
- Check error logs
- Monitor API response times
- Review critical alerts

#### Weekly
- Review database usage
- Check backup status
- Monitor cost

#### Monthly
- Rotate sensitive credentials
- Review performance metrics
- Update dependencies (if needed)

#### Quarterly
- Full security audit
- Performance optimization review
- Disaster recovery drill

---

### 🎯 **Deployment Checklist**

- [ ] All environment variables configured
- [ ] MongoDB connection tested
- [ ] HTTPS enabled
- [ ] Backup strategy in place
- [ ] API rate limiting enabled
- [ ] Error logging configured
- [ ] Email configuration tested
- [ ] SSL certificate verified
- [ ] Database indexes created
- [ ] Monitoring alerts set up
- [ ] Documentation updated
- [ ] Team trained on system
- [ ] Test cycle completed
- [ ] Performance benchmarks met

---

### 📝 **Environment Variables Reference**

| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| MONGODB_URI | `mongodb+srv://...` | Yes | Database connection |
| JWT_SECRET | `your-secret-key` | Yes | JWT signing key |
| JWT_REFRESH_SECRET | `refresh-secret` | Yes | Refresh token key |
| NODE_ENV | `production` | Yes | Environment mode |
| ALLOWED_ORIGINS | `https://domain.com` | Yes | CORS allowed domains |
| BIOMETRIC_API_KEY | `api-key` | No | Biometric API key |
| SMTP_HOST | `smtp.gmail.com` | No | Email SMTP server |
| SMTP_PORT | `587` | No | SMTP port |
| SMTP_USER | `email@gmail.com` | No | SMTP username |
| SMTP_PASSWORD | `password` | No | SMTP password |

---

### 🆘 **Troubleshooting**

#### Database Connection Failed
```
Solution: 
1. Verify MONGODB_URI in .env
2. Check MongoDB IP whitelist includes Vercel IPs
3. Verify user credentials in Atlas
```

#### API Returns 401 Unauthorized
```
Solution:
1. Check JWT_SECRET is set correctly
2. Verify token is being sent in Authorization header
3. Check token hasn't expired
```

#### Large Exports Timeout
```
Solution:
1. Increase maxDuration in vercel.json (max 300 seconds)
2. Implement pagination for large datasets
3. Use background jobs for very large operations
```

#### CORS Errors
```
Solution:
1. Add your domain to ALLOWED_ORIGINS
2. Verify origin header format (https, not http)
3. Check domain exactly matches (case-sensitive)
```

---

### 📞 **Support Resources**

- **Vercel Docs**: https://vercel.com/docs
- **MongoDB Docs**: https://docs.mongodb.com
- **Express Docs**: https://expressjs.com
- **GitHub Issues**: [Your repo URL]/issues
- **Email**: support@company.com

---

### 📄 **Version History**

- **v2.0** (Apr 2024): Appraisal + HR Integration systems
- **v1.5** (Jan 2024): Leave and shift management
- **v1.0** (Oct 2023): Initial payroll system

---

**Last Updated:** April 11, 2026  
**Deployment Ready:** ✅  
**Production Status:** Ready for Launch
