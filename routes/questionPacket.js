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
import { authenticate } from '../middleware/auth.js';

const router = express.Router();


router.post('/create', authenticate, createQuestionPacket);
router.post('/save-draft', authenticate, saveAsDraft);
router.get('/', authenticate, getQuestionPackets);
router.get('/:id', authenticate, getQuestionPacketById);
router.put('/:id', authenticate, updateQuestionPacket);
router.delete('/:id', authenticate, deleteQuestionPacket);
router.post('/:id/submit-answers', authenticate, submitQuestionPacketAnswers);
router.post('/:id/answer-question', authenticate, answerIndividualQuestion);
router.get('/:id/progress', authenticate, getQuestionPacketProgress);

export default router;
