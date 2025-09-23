import express from 'express';
import {
  getAllPlans,
  getPlanById,
  getActivePlans,
  createPlan,
  updatePlan,
  deletePlan
} from '../controllers/planController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();


router.get('/', getAllPlans);
router.get('/active', getActivePlans);
router.get('/:planId', getPlanById);


router.post('/', authenticate, createPlan);
router.put('/:planId', authenticate, updatePlan);
router.delete('/:planId', authenticate, deletePlan);

export default router;
