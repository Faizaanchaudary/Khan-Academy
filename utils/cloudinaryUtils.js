import cloudinary from '../config/cloudinary.js';
import { sendError } from './response.js';

/**
 * Upload team member image to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer from multer
 * @param {string} teamMemberName - Name of the team member for folder organization
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadTeamMemberImage = async (imageBuffer, teamMemberName) => {
  try {
    // Create a unique folder path for team member images
    const folderPath = `khan-academy/team-members/${teamMemberName.toLowerCase().replace(/\s+/g, '-')}`;
    
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: folderPath,
          resource_type: 'image',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
            { quality: 'auto', fetch_format: 'auto' }
          ],
          public_id: `${teamMemberName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(new Error(`Cloudinary upload error: ${error.message}`));
          } else {
            resolve(result);
          }
        }
      ).end(imageBuffer);
    });
  } catch (error) {
    console.error('Team member image upload error:', error);
    throw new Error(`Failed to upload team member image: ${error.message}`);
  }
};

/**
 * Delete team member image from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Cloudinary deletion result
 */
export const deleteTeamMemberImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    });
    
    return result;
  } catch (error) {
    console.error('Team member image deletion error:', error);
    throw new Error(`Failed to delete team member image: ${error.message}`);
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string} Public ID
 */
export const extractPublicIdFromUrl = (url) => {
  try {
    const urlParts = url.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = publicIdWithExtension.split('.')[0];
    return publicId;
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Upload multiple team member images
 * @param {Array} imageBuffers - Array of image buffers
 * @param {Array} teamMemberNames - Array of team member names
 * @returns {Promise<Array>} Array of upload results
 */
export const uploadMultipleTeamMemberImages = async (imageBuffers, teamMemberNames) => {
  try {
    const uploadPromises = imageBuffers.map((buffer, index) => 
      uploadTeamMemberImage(buffer, teamMemberNames[index] || `member-${index + 1}`)
    );
    
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Multiple team member images upload error:', error);
    throw new Error(`Failed to upload multiple team member images: ${error.message}`);
  }
};
