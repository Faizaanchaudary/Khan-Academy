import express from 'express';
import {
  getUsers,
  getUserById,
  updateUser,
  updatePassword,
  getUserProfile,
  getStudents
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/profile', getUserProfile);
router.get('/students', getStudents);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.patch('/:id/password', updatePassword);

export default router;