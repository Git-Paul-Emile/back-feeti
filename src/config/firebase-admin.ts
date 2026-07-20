import admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

if (!admin.apps.length) {
  let serviceAccount: admin.ServiceAccount | null = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      if (!parsed.project_id) {
        console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON ne contient pas de project_id");
      }
      serviceAccount = parsed as admin.ServiceAccount;
    } catch (err) {
      console.error("[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON contient du JSON invalide:", err);
    }
  } else {
    const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8")) as admin.ServiceAccount;
    } else {
      console.error(
        "[firebase-admin] Aucune credentials Firebase trouvée.\n" +
        "  → Variable FIREBASE_SERVICE_ACCOUNT_JSON non définie\n" +
        `  → Fichier ${serviceAccountPath} introuvable\n` +
        "  Firebase Admin ne fonctionnera pas correctement."
      );
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      projectId:     (serviceAccount as any).project_id,
      storageBucket: `${(serviceAccount as any).project_id}.firebasestorage.app`,
    });
  } else {
    console.error("[firebase-admin] Initialisation SANS credentials — les appels Firebase échoueront.");
    admin.initializeApp();
  }
}

export const db        = admin.firestore();
export const fbAuth    = admin.auth();
export const storage   = admin.storage();
export const messaging = admin.messaging();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp  = admin.firestore.Timestamp;

export default admin;