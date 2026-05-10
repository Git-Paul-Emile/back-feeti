import { Router } from 'express';
import { getAllDealCategories } from '../controller/dealCategory.controller.js';

const router = Router();

router.get('/', getAllDealCategories);

export default router;
