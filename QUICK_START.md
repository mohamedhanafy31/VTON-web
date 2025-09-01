# 🚀 Quick Start: Firebase Environment Isolation

## ⚡ Immediate Action Required

Your development and production environments are currently sharing the same Firebase project. This needs to be fixed **immediately** to prevent data contamination.

## 🏃‍♂️ Quick Setup (5 minutes)

### 1. Set Up Development Environment
```bash
# Create development environment configuration
npm run setup:dev
```

### 2. Create Development Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project: `vton-dev`
3. Enable Firestore Database
4. Download service account key as `serviceAccountKey.dev.json`

### 3. Update Development Configuration
Edit the `.env` file that was created:
```env
FIREBASE_PROJECT_ID=vton-dev
FIREBASE_AUTH_DOMAIN=vton-dev.firebaseapp.com
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.dev.json
```

### 4. Test Development Environment
```bash
npm run dev
```

## 📋 What This Achieves

✅ **Complete Environment Isolation**
- Development uses `vton-dev` project
- Production uses `vton-f7059` project
- No more shared data between environments

✅ **Secure Credential Management**
- Environment-specific service account keys
- Proper gitignore configuration
- Template files for easy setup

✅ **Easy Environment Switching**
- `npm run dev` for development
- `npm run prod` for production
- Automatic environment detection

## 🔄 Current vs New Setup

### Before (Current Issue)
```
Development ──┐
              ├── Same Firebase Project (vton-f7059)
Production ───┘
```

### After (Isolated)
```
Development ──── vton-dev (separate project)
Production ───── vton-f7059 (existing project)
```

## 📁 Files Created
- `env.development.template` - Development environment template
- `env.production.template` - Production environment template
- `serviceAccountKey.dev.template.json` - Development Firebase key template
- `serviceAccountKey.prod.template.json` - Production Firebase key template
- `scripts/setup-environment.js` - Environment setup helper
- `FIREBASE_ENVIRONMENT_ISOLATION_GUIDE.md` - Detailed setup guide

## 🆘 Need Help?
See the full guide: `FIREBASE_ENVIRONMENT_ISOLATION_GUIDE.md`

## ⚠️ Important Notes
1. **Never commit** actual service account keys (they're gitignored)
2. **Always verify** which Firebase project you're connected to on startup
3. **Test thoroughly** after switching environments
