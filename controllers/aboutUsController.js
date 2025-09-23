import AboutUs from '../models/AboutUs.js';
import { sendSuccess, sendError } from '../utils/response.js';

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
    const { name, role, image, bio } = req.body;

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
      image,
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

    if (name) section.teamMembers[memberIndex].name = name;
    if (role) section.teamMembers[memberIndex].role = role;
    if (image !== undefined) section.teamMembers[memberIndex].image = image;
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

    section.teamMembers.splice(memberIndex, 1);
    await section.save();

    sendSuccess(res, 'Team member deleted successfully');
  } catch (error) {
    console.error('Delete team member error:', error);
    sendError(res, 'Internal server error while deleting team member');
  }
};