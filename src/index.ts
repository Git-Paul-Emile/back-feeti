import "dotenv/config";
import { createServer } from "http";
import { connectToDatabase } from "./config/database.js";
import app, { allowedOrigins } from "./config/app.js";
import { initSocket } from "./config/socket.js";
import { startEmailWorker } from "./queues/email.worker.js";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];

const missingVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.error(`[feeti2-back] Variables d'environnement manquantes : ${missingVars.join(", ")}`);
  process.exit(1);
}

const DEFAULT_BACKEND_PORT = 8000;

const initializeApp = async () => {
  try {
    await connectToDatabase();
    startEmailWorker();

    const configuredPort = Number(process.env.PORT || DEFAULT_BACKEND_PORT);
    const port = Number.isInteger(configuredPort) && configuredPort > 0
      ? configuredPort
      : DEFAULT_BACKEND_PORT;

    const httpServer = createServer(app);
    initSocket(httpServer, allowedOrigins);

    await new Promise<void>((resolve, reject) => {
      httpServer.listen(port, resolve);
      httpServer.once("error", reject);
    });

    process.env.PORT = String(port);
    console.log(`[feeti2-back] port configure: ${port}`);
    console.log(`[feeti2-back] serveur demarre sur http://localhost:${port}`);
  } catch (err) {
    console.error("Erreur au demarrage :", err);
    process.exit(1);
  }
};

initializeApp();
