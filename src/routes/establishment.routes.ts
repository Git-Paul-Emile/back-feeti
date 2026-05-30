import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/authenticate.js';
import {
  getMyEstablishments,
  getEstablishmentPricing,
  createMyEstablishment,
  initiateSubscription,
  confirmSubscription,
  getSubscriptionStatus,
  initiateDealPaymentRoute,
  confirmDealPaymentRoute,
  getMyDeals,
  updateMyDeal,
  deleteMyDeal,
  getMyPaymentHistory,
} from '../controller/establishment.controller.js';

const router = Router();

// Tarification : publique (pour affichage dans le dashboard)
router.get('/pricing', getEstablishmentPricing);

// Toutes les routes suivantes nécessitent auth + rôle establishment_owner (ou admin)
router.use(authenticate, requireRole('establishment_owner', 'admin', 'super_admin'));

// Établissements
router.post('/create', createMyEstablishment);
router.get('/my', getMyEstablishments);

// Abonnements
router.get('/subscription/status/:leisureItemId', getSubscriptionStatus);
router.post('/subscription/initiate', initiateSubscription);
router.post('/subscription/confirm', confirmSubscription);

// Bon plans
router.post('/deals/payment/initiate', initiateDealPaymentRoute);
router.post('/deals/payment/confirm', confirmDealPaymentRoute);
router.get('/deals', getMyDeals);
router.put('/deals/:id', updateMyDeal);
router.delete('/deals/:id', deleteMyDeal);

// Historique paiements
router.get('/my/payment-history', getMyPaymentHistory);

export default router;
