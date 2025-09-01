#!/usr/bin/env node

/**
 * Environment Setup Script
 * Helps set up development or production environment with proper Firebase isolation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const environments = {
  development: {
    envTemplate: 'env.development.template',
    serviceAccountTemplate: 'serviceAccountKey.dev.template.json',
    serviceAccountTarget: 'serviceAccountKey.dev.json',
    description: 'Development environment with separate Firebase project'
  },
  production: {
    envTemplate: 'env.production.template',
    serviceAccountTemplate: 'serviceAccountKey.prod.template.json',
    serviceAccountTarget: 'serviceAccountKey.prod.json',
    description: 'Production environment with production Firebase project'
  }
};

function showUsage() {
  console.log(`
Environment Setup Script for VTON Web Application

Usage: node scripts/setup-environment.js [development|production]

Available environments:
  development  - ${environments.development.description}
  production   - ${environments.production.description}

Examples:
  node scripts/setup-environment.js development
  node scripts/setup-environment.js production

This script will:
1. Copy the appropriate environment template to .env
2. Create service account key template files
3. Provide instructions for completing the setup
`);
}

function copyTemplate(src, dest, description) {
  const srcPath = path.join(projectRoot, src);
  const destPath = path.join(projectRoot, dest);
  
  if (!fs.existsSync(srcPath)) {
    console.error(`❌ Template file not found: ${src}`);
    return false;
  }
  
  try {
    fs.copyFileSync(srcPath, destPath);
    console.log(`✅ ${description}: ${src} → ${dest}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to copy ${src} to ${dest}:`, error.message);
    return false;
  }
}

function setupEnvironment(env) {
  const config = environments[env];
  
  if (!config) {
    console.error(`❌ Unknown environment: ${env}`);
    console.error('Available environments: development, production');
    return false;
  }
  
  console.log(`\n🚀 Setting up ${env} environment...`);
  console.log(`📝 ${config.description}\n`);
  
  let success = true;
  
  // Copy environment template
  success &= copyTemplate(config.envTemplate, '.env', 'Environment config');
  
  // Show completion message
  if (success) {
    console.log(`\n✅ ${env.charAt(0).toUpperCase() + env.slice(1)} environment setup completed!\n`);
    
    console.log('📋 Next steps:');
    console.log('1. Create a separate Firebase project for this environment');
    console.log('2. Download the service account key from Firebase Console');
    console.log(`3. Save it as: ${config.serviceAccountTarget}`);
    console.log('4. Update the .env file with your Firebase project credentials');
    console.log('5. Update other service credentials (Cloudinary, AI API keys)');
    
    if (env === 'development') {
      console.log('\n🔧 Development-specific notes:');
      console.log('- Consider using a separate Cloudinary account or folder');
      console.log('- Enable debug logging for easier troubleshooting');
      console.log('- Use ngrok for webhook testing');
    } else {
      console.log('\n🔒 Production-specific notes:');
      console.log('- Use strong, unique secrets and API keys');
      console.log('- Enable appropriate security settings');
      console.log('- Configure proper CORS origins');
      console.log('- Review rate limiting settings');
    }
    
    console.log(`\n🏃 To start the ${env} environment:`);
    console.log(`npm run ${env === 'development' ? 'dev' : 'prod'}`);
    
  } else {
    console.log(`\n❌ ${env} environment setup failed. Please check the errors above.`);
  }
  
  return success;
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showUsage();
    process.exit(1);
  }
  
  const environment = args[0].toLowerCase();
  
  if (environment === '--help' || environment === '-h') {
    showUsage();
    process.exit(0);
  }
  
  const success = setupEnvironment(environment);
  process.exit(success ? 0 : 1);
}

// Run the script
main();
