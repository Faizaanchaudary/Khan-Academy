import express from 'express';
import {
  getAllAboutUsSections,
  getAboutUsSection,
  createOrUpdateAboutUsSection,
  bulkUpdateAboutUsSections,
  updateAboutUsSection,
  deleteAboutUsSection,
  getAboutUsPageData,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
  uploadTeamMemberImage
} from '../controllers/aboutUsController.js';
import { authenticate } from '../middleware/auth.js';
import { uploadProfilePicture } from '../middleware/upload.js';

const router = express.Router();


router.get('/', getAllAboutUsSections);
router.get('/page-data', getAboutUsPageData);
router.get('/:sectionType', getAboutUsSection);

router.post('/', authenticate, bulkUpdateAboutUsSections);
router.put('/:sectionType', authenticate, updateAboutUsSection);
router.delete('/:sectionType', authenticate, deleteAboutUsSection);

router.post('/:sectionType/team-members', authenticate, addTeamMember);
router.put('/:sectionType/team-members/:memberId', authenticate, updateTeamMember);
router.delete('/:sectionType/team-members/:memberId', authenticate, deleteTeamMember);
router.post('/:sectionType/team-members/:memberId/upload-image', authenticate, uploadProfilePicture, uploadTeamMemberImage);

export default router;
