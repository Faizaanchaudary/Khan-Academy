import express from 'express';
import {
  createQuestionPacket,
  getQuestionPackets,
  getQuestionPacketById,
  updateQuestionPacket,
  deleteQuestionPacket,
  submitQuestionPacketAnswers,
  saveAsDraft,
  answerIndividualQuestion,
  getQuestionPacketProgress
} from '../controllers/questionPacketController.js';
import { authenticate, requireActiveSubscription } from '../middleware/auth.js';

const router = express.Router();


router.post('/create', authenticate, createQuestionPacket);
router.post('/save-draft', authenticate, saveAsDraft);
router.get('/', authenticate, requireActiveSubscription, getQuestionPackets);
router.get('/:id', authenticate, requireActiveSubscription, getQuestionPacketById);
router.put('/:id', authenticate, updateQuestionPacket);
router.delete('/:id', authenticate, deleteQuestionPacket);
router.post('/:id/submit-answers', authenticate, requireActiveSubscription, submitQuestionPacketAnswers);
router.post('/:id/answer-question', authenticate, requireActiveSubscription, answerIndividualQuestion);
router.get('/:id/progress', authenticate, requireActiveSubscription, getQuestionPacketProgress);

export default router;
