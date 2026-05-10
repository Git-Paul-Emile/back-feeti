import admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      projectId:     serviceAccount.project_id,
      storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
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