import { Router } from 'express';
import { getAllDeals, getDealById, getDealLocations, getDealsByEstablishment } from '../controller/deal.controller.js';

const router = Router();

router.get('/', getAllDeals);
router.get('/locations', getDealLocations);
router.get('/establishment/:leisureItemId', getDealsByEstablishment);
router.get('/:id', getDealById);

export default router;
