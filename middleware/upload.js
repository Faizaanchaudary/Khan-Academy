import multer from 'multer';

// Configure multer to handle file uploads in memory
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
});

// Middleware for single profile picture upload
export const uploadProfilePicture = upload.single('profilePicture');

// Middleware for team member image upload
export const uploadTeamMemberImageFile = upload.single('image');

// Middleware for multiple files (if needed in future)
export const uploadMultipleFiles = upload.array('media', 10);

// Middleware for question image upload
export const uploadQuestionImage = upload.single('image');

export default upload;
