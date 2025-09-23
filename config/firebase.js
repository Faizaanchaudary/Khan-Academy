import admin from 'firebase-admin';
import path from 'path';
import { readFileSync } from 'fs';

const initializeFirebase = () => {
  try {
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      serviceAccount = JSON.parse(readFileSync('./khan-academy-d576a-firebase-adminsdk-fbsvc-495788f730.json', 'utf8'));
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'khan-academy-d576a'
      });
    }

    console.log('Firebase initialized successfully');
    return admin;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

export { initializeFirebase, admin };