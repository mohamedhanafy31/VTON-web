import admin from 'firebase-admin';
import bcrypt from 'bcrypt';
import { readFile } from 'fs/promises';

// Load service account key
let serviceAccount;
try {
  serviceAccount = JSON.parse(
    await readFile(new URL('serviceAccountKey.json', import.meta.url))
  );
  console.log('Service account loaded:', serviceAccount.project_id);
} catch (error) {
  console.error('Failed to load serviceAccountKey.json:', {
    message: error.message,
    code: error.code,
    stack: error.stack
  });
  process.exit(1);
}

// Initialize Firebase Admin SDK
let db;
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin SDK initialized successfully');
  } else {
    console.log('Firebase Admin SDK already initialized, skipping initialization');
  }
  db = admin.firestore();
} catch (error) {
  console.error('Failed to initialize Firebase Admin SDK:', {
    message: error.message,
    code: error.code,
    details: error.details,
    stack: error.stack
  });
  db = null;
  process.exit(1);
}

// Define password and bcrypt config
const password = 'Meta#Vr#Ai@2025/SM';
const saltRounds = 10;

// Toggle: true = use `informations.password`, false = use `pass` directly
const useNestedField = false;

async function updateAdminPassword() {
  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Hashed password:', hash);

    if (!db) {
      console.warn('Firestore is unavailable. Generated hash:', hash);
      process.exit(1);
    }

    const docRef = db.collection('admin').doc('account');
    const doc = await docRef.get();

    if (!doc.exists) {
      console.error('Document `account` does not exist in collection `admin`.');
      process.exit(1);
    }

    const data = doc.data();

    if (useNestedField) {
      // Ensure informations field exists
      if (!data.informations) {
        console.log('Field `informations` not found. Creating it...');
        await docRef.set(
          {
            informations: {
              password: hash
            }
          },
          { merge: true }
        );
      } else {
        await docRef.update({
          'informations.password': hash
        });
      }
    } else {
      await docRef.update({
        pass: hash
      });
    }

    console.log('✅ Successfully updated admin password.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin password:', {
      message: error.message,
      code: error.code,
      details: error.details,
      stack: error.stack
    });
    process.exit(1);
  }
}

// Run it
updateAdminPassword();
