import admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

if (!admin.apps.length) {
  let serviceAccount: admin.ServiceAccount | null = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as admin.ServiceAccount;
  } else {
    const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8")) as admin.ServiceAccount;
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      projectId:     (serviceAccount as any).project_id,
      storageBucket: `${(serviceAccount as any).project_id}.firebasestorage.app`,
    });
  } else {
    admin.initializeApp();
  }
}

export const db        = admin.firestore();
export const fbAuth    = admin.auth();
export const storage   = admin.storage();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp  = admin.firestore.Timestamp;

export default admin;