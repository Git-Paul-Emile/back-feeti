import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import {
  getAllLeisureCategories,
  getAllLeisureItems,
  getLeisureItemById,
  getMyLeisureFavorites,
  checkLeisureFavorite,
  toggleLeisureFavorite,
} from '../controller/leisure.controller.js';

const router = Router();

router.get('/categories', getAllLeisureCategories);
router.get('/favorites', authenticate, getMyLeisureFavorites);
router.get('/:id/favorite', authenticate, checkLeisureFavorite);
router.post('/:id/favorite', authenticate, toggleLeisureFavorite);
router.get('/', getAllLeisureItems);
router.get('/:id', getLeisureItemById);

export default router;
