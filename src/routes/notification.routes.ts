import { Router } from "express";
import { authenticate, requireRole } from "../middlewares/authenticate.js";
import {
  sendEmail,
  sendTicketConfirmationEmail,
  sendEventReminderEmail,
  sendSMS,
  sendTicketConfirmationSMS,
  sendPushNotification,
  sendPushMultiple,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendToTopic,
} from "../controller/notification.controller.js";

const router = Router();

// Email : admin uniquement pour envoi générique
router.post("/email/send", authenticate, requireRole("admin", "super_admin"), sendEmail);

// Email de confirmation de billet (appelé par le flux d'achat)
router.post("/email/ticket-confirmation", authenticate, sendTicketConfirmationEmail);

// Rappel événement (appelé par le scheduler/cron)
router.post("/email/event-reminder", authenticate, requireRole("admin", "super_admin"), sendEventReminderEmail);

// SMS (simulé — intégration Twilio)
router.post("/sms/send", authenticate, requireRole("admin", "super_admin"), sendSMS);
router.post("/sms/ticket-confirmation", authenticate, sendTicketConfirmationSMS);

// Push notifications
router.post("/push/send", authenticate, requireRole("admin", "super_admin"), sendPushNotification);
router.post("/push/send-multiple", authenticate, requireRole("admin", "super_admin"), sendPushMultiple);
router.post("/push/subscribe", authenticate, subscribeToTopic);
router.post("/push/unsubscribe", authenticate, unsubscribeFromTopic);
router.post("/push/send-to-topic", authenticate, requireRole("admin", "super_admin"), sendToTopic);

export default router;
