/**
 * Application Configuration
 * Contains global constants and configuration settings
 */

const CONFIG = {
  // Firebase configuration
  firebase: {
    apiKey: "AIzaSyA1L2ZtAGllfUEyE2phFjQkELGTFCFyDrw",
    authDomain: "metavrai-96ea0.firebaseapp.com",
    projectId: "metavrai-96ea0",
    storageBucket: "metavrai-96ea0.appspot.com",
    messagingSenderId: "145475975078",
    appId: "1:145475975078:web:77dac9e151aa00f193449f"
  },
  
  // API settings
  api: {
    key: "dd240ad8f2e64de35e0b25ecddf1b42c2a7e637d",
    baseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:3000' 
      : window.location.origin,
    endpoints: {
      ngrokUrl: '/public-url',
      stores: '/active-stores',
      storeGarments: '/store-garments',
      storeTrials: '/store-trials',
      upload: '/upload',
      tryon: '/tryon',
      checkSession: '/check-session',
      getResult: '/get-result',
      updateTrials: '/update-trials',
      ethLogin: '/eth-login',
      connect: '/connect-account',
      logout: '/logout',
      diagnostic: '/diagnostic'
    }
  },
  
  // Default store for fallback
  defaultStore: {
    store_name: 'Nike',
    specialization: 'shoes',
    logo_link: 'https://res.cloudinary.com/dj3ewvbqm/image/upload/v1746783992/stores_logos/nike_logo_1746783995689.png',
    tryon_limit: 20,
    garment_limit: 5,
    country: 'america'
  },
  
  // Camera settings
  camera: {
    countdownTime: 3,
    idealWidth: 1280,
    idealHeight: 720,
    jpegQuality: 0.9
  },
  
  // User credentials for auto-login
  defaultCredentials: {
    email: "Nike@metevr.shop",
    password: "Nike@metaVrAdmin"
  },
  
  // UI settings
  ui: {
    toastDuration: {
      default: 4000,
      error: 6000,
      warning: 5000,
      success: 3000
    },
    maxGarments: 6
  }
}; 