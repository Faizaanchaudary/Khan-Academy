import AboutUs from '../models/AboutUs.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { uploadTeamMemberImage as uploadImageToCloudinary, deleteTeamMemberImage, extractPublicIdFromUrl } from '../utils/cloudinaryUtils.js';

export const getAllAboutUsSections = async (req, res) => {
  try {
    const sections = await AboutUs.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    sendSuccess(res, 'About Us sections retrieved successfully', { sections });
  } catch (error) {
    console.error('Get About Us sections error:', error);
    sendError(res, 'Internal server error while retrieving About Us sections');
  }
};

export const getAboutUsSection = async (req, res) => {
  try {
    const { sectionType } = req.params;

    const section = await AboutUs.findOne({ 
      section: sectionType,
      isActive: true 
    });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    sendSuccess(res, 'About Us section retrieved successfully', { section });
  } catch (error) {
    console.error('Get About Us section error:', error);
    sendError(res, 'Internal server error while retrieving About Us section');
  }
};

export const createOrUpdateAboutUsSection = async (req, res) => {
  try {
    // Check if request body contains sections array (bulk update)
    if (req.body.sections && Array.isArray(req.body.sections)) {
      return await bulkUpdateAboutUsSections(req, res);
    }

    // Single section update
    const { section, title, subtitle, content, features, teamMembers, images, order } = req.body;

    if (!section || !title || !content) {
      return sendError(res, 'Section, title, and content are required', 400);
    }

    const existingSection = await AboutUs.findOne({ section });

    if (existingSection) {
      existingSection.title = title;
      existingSection.subtitle = subtitle;
      existingSection.content = content;
      existingSection.features = features || [];
      existingSection.teamMembers = teamMembers || [];
      existingSection.images = images || [];
      existingSection.order = order || existingSection.order;

      await existingSection.save();

      sendSuccess(res, 'About Us section updated successfully', { section: existingSection });
    } else {
      const newSection = new AboutUs({
        section,
        title,
        subtitle,
        content,
        features: features || [],
        teamMembers: teamMembers || [],
        images: images || [],
        order: order || 0
      });

      await newSection.save();

      sendSuccess(res, 'About Us section created successfully', { section: newSection }, 201);
    }
  } catch (error) {
    console.error('Create/Update About Us section error:', error);
    sendError(res, 'Internal server error while creating/updating About Us section');
  }
};

export const bulkUpdateAboutUsSections = async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return sendError(res, 'Sections array is required for bulk update', 400);
    }

    const results = {
      created: [],
      updated: [],
      errors: []
    };

    for (const sectionData of sections) {
      try {
        const { section, title, subtitle, content, features, teamMembers, images, order } = sectionData;

        if (!section || !title || !content) {
          results.errors.push({
            section: section || 'unknown',
            error: 'Section, title, and content are required'
          });
          continue;
        }

        const existingSection = await AboutUs.findOne({ section });

        if (existingSection) {
          existingSection.title = title;
          existingSection.subtitle = subtitle;
          existingSection.content = content;
          existingSection.features = features || [];
          existingSection.teamMembers = teamMembers || [];
          existingSection.images = images || [];
          existingSection.order = order !== undefined ? order : existingSection.order;

          await existingSection.save();
          results.updated.push(existingSection);
        } else {
          const newSection = new AboutUs({
            section,
            title,
            subtitle,
            content,
            features: features || [],
            teamMembers: teamMembers || [],
            images: images || [],
            order: order || 0
          });

          await newSection.save();
          results.created.push(newSection);
        }
      } catch (sectionError) {
        console.error(`Error processing section ${sectionData.section}:`, sectionError);
        results.errors.push({
          section: sectionData.section || 'unknown',
          error: sectionError.message
        });
      }
    }

    const totalProcessed = results.created.length + results.updated.length;
    const message = `Bulk update completed. ${totalProcessed} sections processed successfully. ${results.errors.length} errors occurred.`;

    sendSuccess(res, message, results);
  } catch (error) {
    console.error('Bulk update About Us sections error:', error);
    sendError(res, 'Internal server error while bulk updating About Us sections');
  }
};

export const updateAboutUsSection = async (req, res) => {
  try {
    const { sectionType } = req.params;
    const { title, subtitle, content, features, teamMembers, images, order, isActive } = req.body;

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    if (title) section.title = title;
    if (subtitle !== undefined) section.subtitle = subtitle;
    if (content) section.content = content;
    if (features) section.features = features;
    if (teamMembers) section.teamMembers = teamMembers;
    if (images) section.images = images;
    if (order !== undefined) section.order = order;
    if (isActive !== undefined) section.isActive = isActive;

    await section.save();

    sendSuccess(res, 'About Us section updated successfully', { section });
  } catch (error) {
    console.error('Update About Us section error:', error);
    sendError(res, 'Internal server error while updating About Us section');
  }
};

export const deleteAboutUsSection = async (req, res) => {
  try {
    const { sectionType } = req.params;

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    await AboutUs.findByIdAndDelete(section._id);

    sendSuccess(res, 'About Us section deleted successfully');
  } catch (error) {
    console.error('Delete About Us section error:', error);
    sendError(res, 'Internal server error while deleting About Us section');
  }
};

export const getAboutUsPageData = async (req, res) => {
  try {
    const sections = await AboutUs.find({ isActive: true })
      .sort({ order: 1 })
      .lean();

    const pageData = {
      whatStudentsSay: sections.find(s => s.section === 'what_students_say'),
      whatWeDo: sections.find(s => s.section === 'what_we_do'),
      ourCoreValues: sections.find(s => s.section === 'our_core_values'),
      ourMission: sections.find(s => s.section === 'our_mission'),
      ourVision: sections.find(s => s.section === 'our_vision'),
      meetOurTeam: sections.find(s => s.section === 'meet_our_team')
    };

    sendSuccess(res, 'About Us page data retrieved successfully', { pageData });
  } catch (error) {
    console.error('Get About Us page data error:', error);
    sendError(res, 'Internal server error while retrieving About Us page data');
  }
};

export const addTeamMember = async (req, res) => {
  try {
    const { sectionType } = req.params;
    const { name, role, bio } = req.body;

    if (!name || !role) {
      return sendError(res, 'Name and role are required', 400);
    }

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    const newTeamMember = {
      name,
      role,
      image: '', // Will be set if image is uploaded
      bio
    };

    section.teamMembers.push(newTeamMember);
    await section.save();

    sendSuccess(res, 'Team member added successfully', { teamMember: newTeamMember });
  } catch (error) {
    console.error('Add team member error:', error);
    sendError(res, 'Internal server error while adding team member');
  }
};

export const uploadTeamMemberImage = async (req, res) => {
  try {
    const { sectionType, memberId } = req.params;

    if (!req.file) {
      return sendError(res, 'No image file provided', 400);
    }

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    const memberIndex = section.teamMembers.findIndex(member => member._id.toString() === memberId);

    if (memberIndex === -1) {
      return sendError(res, 'Team member not found', 404);
    }

    const teamMember = section.teamMembers[memberIndex];
    
    // Delete old image if exists
    if (teamMember.image) {
      try {
        const publicId = extractPublicIdFromUrl(teamMember.image);
        if (publicId) {
          await deleteTeamMemberImage(publicId);
        }
      } catch (deleteError) {
        console.warn('Could not delete old image:', deleteError.message);
      }
    }

    // Upload new image
    console.log('Uploading image for team member:', teamMember.name);
    const uploadResult = await uploadImageToCloudinary(req.file.buffer, teamMember.name);
    console.log('Upload result:', uploadResult);
    
    // Update team member with new image URL
    section.teamMembers[memberIndex].image = uploadResult.secure_url;
    console.log('Updated team member image URL:', section.teamMembers[memberIndex].image);
    await section.save();
    console.log('Section saved successfully');

    sendSuccess(res, 'Team member image uploaded successfully', { 
      teamMember: section.teamMembers[memberIndex],
      imageUrl: uploadResult.secure_url
    });
  } catch (error) {
    console.error('Upload team member image error:', error);
    sendError(res, 'Internal server error while uploading team member image');
  }
};

export const updateTeamMember = async (req, res) => {
  try {
    const { sectionType, memberId } = req.params;
    const { name, role, image, bio } = req.body;

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    const memberIndex = section.teamMembers.findIndex(member => member._id.toString() === memberId);

    if (memberIndex === -1) {
      return sendError(res, 'Team member not found', 404);
    }

    const teamMember = section.teamMembers[memberIndex];
    const oldImage = teamMember.image;

    if (name) section.teamMembers[memberIndex].name = name;
    if (role) section.teamMembers[memberIndex].role = role;
    if (image !== undefined) {
      // If image is being removed or changed, delete old image from Cloudinary
      if (oldImage && (image === '' || image !== oldImage)) {
        try {
          const publicId = extractPublicIdFromUrl(oldImage);
          if (publicId) {
            await deleteTeamMemberImage(publicId);
          }
        } catch (deleteError) {
          console.warn('Could not delete old image:', deleteError.message);
        }
      }
      section.teamMembers[memberIndex].image = image;
    }
    if (bio !== undefined) section.teamMembers[memberIndex].bio = bio;

    await section.save();

    sendSuccess(res, 'Team member updated successfully', { teamMember: section.teamMembers[memberIndex] });
  } catch (error) {
    console.error('Update team member error:', error);
    sendError(res, 'Internal server error while updating team member');
  }
};

export const deleteTeamMember = async (req, res) => {
  try {
    const { sectionType, memberId } = req.params;

    const section = await AboutUs.findOne({ section: sectionType });

    if (!section) {
      return sendError(res, 'About Us section not found', 404);
    }

    const memberIndex = section.teamMembers.findIndex(member => member._id.toString() === memberId);

    if (memberIndex === -1) {
      return sendError(res, 'Team member not found', 404);
    }

    const teamMember = section.teamMembers[memberIndex];
    
    // Delete image from Cloudinary if exists
    if (teamMember.image) {
      try {
        const publicId = extractPublicIdFromUrl(teamMember.image);
        if (publicId) {
          await deleteTeamMemberImage(publicId);
        }
      } catch (deleteError) {
        console.warn('Could not delete team member image:', deleteError.message);
      }
    }

    section.teamMembers.splice(memberIndex, 1);
    await section.save();

    sendSuccess(res, 'Team member deleted successfully');
  } catch (error) {
    console.error('Delete team member error:', error);
    sendError(res, 'Internal server error while deleting team member');
  }
};

export const updateAboutUsContent = async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return sendError(res, 'Sections array is required', 400);
    }

    const results = {
      updated: [],
      errors: []
    };

    for (const sectionData of sections) {
      try {
        const { section, content } = sectionData;

        if (!section || !content) {
          results.errors.push({
            section: section || 'unknown',
            error: 'Section and content are required'
          });
          continue;
        }

        // Validate section type
        const validSections = [
          'what_students_say',
          'what_we_do',
          'our_core_values',
          'our_mission',
          'our_vision',
          'meet_our_team'
        ];

        if (!validSections.includes(section)) {
          results.errors.push({
            section,
            error: `Invalid section type. Must be one of: ${validSections.join(', ')}`
          });
          continue;
        }

        const existingSection = await AboutUs.findOne({ section });

        if (!existingSection) {
          results.errors.push({
            section,
            error: 'Section not found'
          });
          continue;
        }

        // Update only the content field
        existingSection.content = content;
        await existingSection.save();

        results.updated.push({
          section: existingSection.section,
          content: existingSection.content,
          title: existingSection.title
        });
      } catch (sectionError) {
        console.error(`Error updating section ${sectionData.section}:`, sectionError);
        results.errors.push({
          section: sectionData.section || 'unknown',
          error: sectionError.message
        });
      }
    }

    const totalUpdated = results.updated.length;
    const totalErrors = results.errors.length;
    
    let message = `Content update completed. ${totalUpdated} sections updated successfully.`;
    if (totalErrors > 0) {
      message += ` ${totalErrors} errors occurred.`;
    }

    sendSuccess(res, message, results);
  } catch (error) {
    console.error('Update About Us content error:', error);
    sendError(res, 'Internal server error while updating About Us content');
  }
};