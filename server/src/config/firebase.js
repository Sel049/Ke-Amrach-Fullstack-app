// firebaseAdmin.js
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

const {
  FIREBASE_PROJECT_ID: projectId,
  FIREBASE_CLIENT_EMAIL: clientEmail,
  FIREBASE_PRIVATE_KEY: rawPrivateKey,
  USE_APPLICATION_DEFAULT = "false",
} = process.env;

function formatPrivateKey(pk) {
  if (!pk) return pk;
  // Remove surrounding quotes if present and convert literal \n to real newlines
  return pk.replace(/^"(.*)"$/s, "$1").replace(/\\n/g, "\n");
}

function validatePem(privateKey) {
  return (
    typeof privateKey === "string" &&
    /-----BEGIN PRIVATE KEY-----[\s\S]*-----END PRIVATE KEY-----/m.test(privateKey)
  );
}

function exitWithError(message) {
  console.error("❌ Firebase initialization error:", message);
  // give the message a second to flush, then exit with failure
  process.exitCode = 1;
  throw new Error(message);
}

export function initializeFirebaseStrict() {
  try {
    const privateKey = formatPrivateKey(rawPrivateKey);

    const hasAll = Boolean(projectId && clientEmail && privateKey);
    const pemOk = hasAll && validatePem(privateKey);

    // If the developer explicitly asked to use application default (GCP), allow it
    if (USE_APPLICATION_DEFAULT.toLowerCase() === "true") {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId,
        });
        console.log("✅ Firebase initialized with application default credentials (explicit).");
        if (process.env.NODE_ENV === 'development') {
          console.log(`🧩 Firebase project (server): ${projectId}`);
        }
      }
      return admin;
    }

    // If missing credentials
    if (!hasAll) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("⚠️  Firebase admin credentials are missing. Running in development without Firebase Admin.");
        // Provide a safe stub so imports don't crash; auth middleware already supports dev mode
        return {
          auth() {
            return {
              async verifyIdToken() {
                throw new Error('Firebase Admin not configured');
              },
            };
          },
        };
      }
      exitWithError(
        "Missing Firebase admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your environment."
      );
    }

    if (!pemOk) {
      exitWithError(
        "Invalid FIREBASE_PRIVATE_KEY PEM format. Ensure the private key is stored in .env as a single line with literal \\n for newlines and wrapped in quotes."
      );
    }

    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey,
    };

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase initialized with provided service account credentials");
      if (process.env.NODE_ENV === 'development') {
        console.log(`🧩 Firebase project (server): ${projectId}`);
      }
    }

    return admin;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn("⚠️  Firebase initialization failed in development:", err && err.message ? err.message : err);
      return {
        auth() {
          return {
            async verifyIdToken() {
              throw new Error('Firebase Admin not configured');
            },
          };
        },
      };
    }
    console.error("❌ Firebase initialization failed:", err && err.message ? err.message : err);
    process.exitCode = 1;
    throw err;
  }
}

// run initialization immediately (keeps same behavior as before)
const adminInstance = initializeFirebaseStrict();
export default adminInstance;
