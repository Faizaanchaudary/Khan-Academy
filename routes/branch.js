import express from 'express';
import {
  getAllBranches,
  getBranchById,
  getBranchBasicInfo,
  getBranchesByCategory,
  createBranch,
  updateBranch,
  deleteBranch,
  createGuideBook,
  getGuideBookByBranchId
} from '../controllers/branchController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', optionalAuth, getAllBranches); 
router.get('/category/:category', optionalAuth, getBranchesByCategory);
router.get('/id/:branchId', getBranchById);
router.get('/detail/:branchId', getBranchBasicInfo);
router.post('/', authenticate, createBranch);
router.put('/:branchId', authenticate, updateBranch);
router.delete('/:branchId', authenticate, deleteBranch);

// Guide Book Routes
router.post('/guide-book', authenticate, createGuideBook);
router.get('/:branchId/guide-book', getGuideBookByBranchId);

export default router;