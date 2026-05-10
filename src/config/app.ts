import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../utils/AppError.js";
import authRouter from "../routes/auth.routes.js";
import eventRouter from "../routes/event.routes.js";
import uploadRouter from "../routes/upload.routes.js";
import ticketRouter from "../routes/ticket.routes.js";
import adminRouter from "../routes/admin.routes.js";
import categoryRouter from "../routes/category.routes.js";
import countryRouter from "../routes/country.routes.js";
import dealRouter from "../routes/deal.routes.js";
import dealCategoryRouter from "../routes/dealCategory.routes.js";
import leisureRouter from "../routes/leisure.routes.js";
import blogRouter from "../routes/blog.routes.js";
import controllerRouter from "../routes/controller.routes.js";
import deliveryRouter from "../routes/delivery.routes.js";
import transactionRouter from "../routes/transaction.routes.js";
import walletRouter from "../routes/wallet.routes.js";
import payoutRouter from "../routes/payout.routes.js";
import reportingRouter from "../routes/reporting.routes.js";
import loyaltyRouter from "../routes/loyalty.routes.js";
import integrationRouter from "../routes/integration.routes.js";
import liveEventConsentRouter from "../routes/liveEventConsent.routes.js";
import paymentRouter from "../routes/payment.routes.js";
import accessRouter from "../routes/access.routes.js";
import chatbotRouter from "../routes/chatbot.routes.js";




const app = express();




const buildLocalhostOrigins = (startPort: number, count: number) =>
  Array.from({ length: count }, (_, index) => `http://localhost:${startPort + index}`);

const configuredFrontUrl = process.env.FRONT_URL || 'http://localhost:3000';
const configuredFeetiPlayUrl = process.env.FEETIPLAY_URL || 'http://localhost:5173';

export const allowedOrigins = [
  configuredFrontUrl,
  configuredFeetiPlayUrl,
  'http://localhost:8080',
  ...buildLocalhostOrigins(3000, 3),
  ...buildLocalhostOrigins(5173, 3),
];








// Configuration CORS
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allowed?: boolean) => void) => {
    // Allow requests with no origin (e.g., curl, mobile apps)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'), false);
  },
  credentials: true,
};








app.use(cors(corsOptions));




// Parser JSON et cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());












// Routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'API opérationnelle' });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tickets', ticketRouter);
app.use('/api/admin', adminRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/countries', countryRouter);
app.use('/api/deals', dealRouter);
app.use('/api/deal-categories', dealCategoryRouter);
app.use('/api/leisure', leisureRouter);
app.use('/api/blog', blogRouter);
app.use('/api/controller', controllerRouter);
app.use('/api/delivery', deliveryRouter);
// ─── Système financier ────────────────────────────────────────────────
app.use('/api/transactions', transactionRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/payouts', payoutRouter);
app.use('/api/reporting', reportingRouter);
// ─── Feeti Na Feeti — Fidélité ────────────────────────────────────────────────
app.use('/api/loyalty', loyaltyRouter);
// ─── Intégration FeetiPlay ────────────────────────────────────────────────────
app.use('/api/integration', integrationRouter);
// ─── Consentement événements live/mixte ──────────────────────────────────────
app.use('/api/live-event-consent', liveEventConsentRouter);
// ─── Paiements (simulation) ───────────────────────────────────────────────────
app.use('/api/payments', paymentRouter);
// ─── Feeti Access — Contrôle d'accès & Gestion des zones ─────────────────────
app.use('/api/access', accessRouter);
// ─── Chatbot Dialogflow ───────────────────────────────────────────────────────
app.use('/api/chatbot', chatbotRouter);








// Middleware pour routes non trouvées
app.use((_req, res) => {
 res.status(StatusCodes.NOT_FOUND).json({ message: "Route non trouvée" });
});




// Middleware de gestion des erreurs
app.use((err: Error | AppError, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);




  // Gestion des erreurs Prisma (qui ont 'code' et 'meta')
  if ('code' in err && typeof err.code === 'string') {
    switch (err.code) {
      case 'P2002':
        return res.status(StatusCodes.BAD_REQUEST).json({
          message: `Conflit unique sur le champ: ${(err as any).meta?.target || 'inconnu'}`
        });
      case 'P2025':
        return res.status(StatusCodes.NOT_FOUND).json({ message: 'Ressource non trouvée' });
      default:
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Erreur de base de données inconnue' });
    }
  }




  // Gestion des AppError et autres erreurs
  const statusCode = (err instanceof AppError) ? err.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Erreur interne du serveur';
  const errors = (err instanceof AppError) ? err.errors : undefined;
  res.status(statusCode).json({ message, ...(errors && { errors }) });
});




export default app;
