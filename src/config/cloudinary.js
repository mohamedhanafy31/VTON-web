import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with hardcoded values
cloudinary.config({
  cloud_name: 'dj3ewvbqm',
  api_key: '168548754285954',
  api_secret: '3EuyZu2aeVwvGXv-obad0DKephc',
  secure: true // Use HTTPS
});

// Test the configuration
cloudinary.api.ping()
  .then(() => console.log('✅ Cloudinary configuration successful'))
  .catch(error => {
    console.error('❌ Cloudinary configuration failed:', error);
    process.exit(1);
  });

export default cloudinary; 