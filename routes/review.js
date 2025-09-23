import express from 'express';
import {
  addReview,
  getReviews,
  approveReview,
  declineReview,
  getStudentReviews,
  getAdmins,
  getReviewsByStatus,
  getReviewCounts,
  getAllReviewsWithCounts
} from '../controllers/reviewController.js';
import { authenticate } from '../middleware/auth.js';
import {
  validateReviewSubmission
} from '../middleware/validation.js';

const router = express.Router();


router.use(authenticate);

// Student routes
router.post('/', validateReviewSubmission, addReview);
router.get('/my-reviews', getStudentReviews);
router.get('/admins', getAdmins);

// Admin routes - Status filtering
router.get('/counts', getReviewCounts);
router.get('/status/:status', getReviewsByStatus);
router.get('/count', getAllReviewsWithCounts);
router.get('/', getReviews);
router.patch('/:id/approve', approveReview);
router.patch('/:id/decline', declineReview);

export default router;
