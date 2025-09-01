# Firebase Environment Isolation Guide

## 🚨 Current Issue
Your development and production environments are currently sharing the same Firebase project (`vton-f7059`), which can lead to:
- Data contamination between environments
- Accidental modification of production data during development
- Security risks from shared credentials
- Difficulty in testing without affecting live users

## 🎯 Solution Overview
This guide implements a complete environment isolation strategy using separate Firebase projects for development and production.

## 📁 New File Structure
```
VTON-web/
├── env.development.template    # Development environment template
├── env.production.template     # Production environment template
├── serviceAccountKey.dev.template.json   # Dev Firebase credentials template
├── serviceAccountKey.prod.template.json  # Prod Firebase credentials template
├── scripts/
│   └── setup-environment.js   # Environment setup helper script
└── .env                       # Active environment (gitignored)
```

## 🛠️ Setup Instructions

### Step 1: Create Separate Firebase Projects

#### For Development:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named `vton-dev` (or similar)
3. Enable Firestore Database
4. Set up the same collections structure as your production
5. Create a service account:
   - Go to Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save as `serviceAccountKey.dev.json` (will be gitignored)

#### For Production:
1. Your existing `vton-f7059` project will serve as production
2. Download a fresh service account key
3. Save as `serviceAccountKey.prod.json` (will be gitignored)

### Step 2: Set Up Development Environment
```bash
# Option 1: Use the setup script
node scripts/setup-environment.js development

# Option 2: Manual setup
npm run setup:dev
```

### Step 3: Configure Development Environment
1. Edit the `.env` file (created from template)
2. Update Firebase credentials:
   ```env
   FIREBASE_PROJECT_ID=vton-dev
   FIREBASE_AUTH_DOMAIN=vton-dev.firebaseapp.com
   FIREBASE_STORAGE_BUCKET=vton-dev.appspot.com
   # ... other Firebase config
   ```
3. Update service account path:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.dev.json
   ```

### Step 4: Set Up Production Environment
```bash
# When deploying to production
node scripts/setup-environment.js production
# or
npm run setup:prod
```

## 🚀 Running Different Environments

### Development
```bash
npm run dev
# or
npm run start:dev
```

### Production
```bash
npm run prod
# or
npm run start:prod
```

## 🔒 Security Considerations

### Development Environment
- Use separate API keys for third-party services when possible
- Enable debug logging for easier troubleshooting
- Use development-specific Cloudinary folders
- Allow broader CORS origins for local testing

### Production Environment
- Use strong, unique secrets and API keys
- Disable debug logging
- Restrict CORS to your production domains
- Enable proper rate limiting
- Set `TRUST_PROXY=true` if behind a reverse proxy

## 📊 Database Isolation Strategy

### Collections Structure
Both environments should have the same collections but separate data:

**Development (`vton-dev`):**
- `garments` - Test garments for development
- `orders` - Test orders
- `users` - Development user accounts
- `stores` - Test store configurations

**Production (`vton-f7059`):**
- `garments` - Live product catalog
- `orders` - Real customer orders
- `users` - Production user accounts
- `stores` - Live store configurations

### Data Migration
If you need to copy production data to development:
```bash
# Use Firebase CLI to export/import data
firebase firestore:export gs://vton-f7059.appspot.com/backup
firebase firestore:import gs://vton-dev.appspot.com/backup --project vton-dev
```

## 🔧 Configuration Management

### Environment Variables Hierarchy
1. `.env` file (active environment)
2. Environment-specific templates
3. `env.example` (fallback defaults)

### Service Account Keys Management
- **NEVER** commit actual service account keys
- Use different keys for each environment
- Rotate keys regularly
- Monitor key usage in Firebase Console

## 🛠️ Development Workflow

### Starting Development
```bash
# 1. Set up development environment
npm run setup:dev

# 2. Update .env with your dev Firebase credentials

# 3. Start development server
npm run dev
```

### Deploying to Production
```bash
# 1. Set up production environment
npm run setup:prod

# 2. Update .env with production credentials

# 3. Start production server
npm run prod
```

## 🔍 Validation and Testing

### Validate Configuration
```bash
npm run validate-config
```

### Check Current Environment
The application will log which Firebase project it's connecting to on startup.

### Test Database Connection
Both environments include connection testing to verify proper isolation.

## 📝 Best Practices

### 1. Environment Naming
- Development: `vton-dev`, `vton-development`, or `vton-staging`
- Production: `vton-prod`, `vton-production`, or keep existing `vton-f7059`

### 2. Data Management
- Keep development data minimal and anonymized
- Regularly clean up development data
- Use test data that doesn't reflect real users

### 3. Credential Management
- Use environment-specific service accounts
- Enable only necessary Firebase services per environment
- Monitor Firebase usage and billing per project

### 4. Testing
- Test new features in development first
- Validate Firebase rules in development
- Test data migration scripts in development

## ⚠️ Migration Checklist

- [ ] Create development Firebase project
- [ ] Set up Firestore collections in development
- [ ] Download service account keys for both environments
- [ ] Update environment configuration files
- [ ] Test development environment startup
- [ ] Verify database isolation
- [ ] Update deployment scripts
- [ ] Train team on new workflow

## 🆘 Troubleshooting

### Issue: "Firebase project not found"
- Verify `FIREBASE_PROJECT_ID` in `.env`
- Check service account key file exists
- Ensure service account has proper permissions

### Issue: "Permission denied"
- Verify service account key is valid
- Check Firebase IAM permissions
- Ensure Firestore rules allow access

### Issue: "Development and production data mixing"
- Check `GOOGLE_APPLICATION_CREDENTIALS` path
- Verify `.env` file has correct project ID
- Restart application after environment changes

## 📞 Support
If you encounter issues during migration, check:
1. Firebase Console for project status
2. Application logs for connection errors
3. Environment configuration validation
