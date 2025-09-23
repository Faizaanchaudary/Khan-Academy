import Plan from '../models/Plan.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .sort({ price: 1 })
      .lean();

    sendSuccess(res, 'Plans retrieved successfully', { plans });
  } catch (error) {
    console.error('Get plans error:', error);
    sendError(res, 'Internal server error while retrieving plans');
  }
};

export const getPlanById = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    sendSuccess(res, 'Plan retrieved successfully', { plan });
  } catch (error) {
    console.error('Get plan error:', error);
    sendError(res, 'Internal server error while retrieving plan');
  }
};

export const createPlan = async (req, res) => {
  try {
    const { name, tagline, price, currency, billingCycle, trialDays, features } = req.body;

    if (!name || !tagline || price === undefined || !features || !Array.isArray(features)) {
      return sendError(res, 'Name, tagline, price, and features are required', 400);
    }

    const existingPlan = await Plan.findOne({ name });
    if (existingPlan) {
      return sendError(res, 'Plan with this name already exists', 400);
    }

    const plan = new Plan({
      name,
      tagline,
      price,
      currency: currency || 'USD',
      billingCycle: billingCycle || 'monthly',
      trialDays: trialDays || 0,
      features
    });

    await plan.save();

    sendSuccess(res, 'Plan created successfully', { plan }, 201);
  } catch (error) {
    console.error('Create plan error:', error);
    sendError(res, 'Internal server error while creating plan');
  }
};

export const updatePlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, tagline, price, currency, billingCycle, trialDays, features, isActive } = req.body;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    if (name) plan.name = name;
    if (tagline) plan.tagline = tagline;
    if (price !== undefined) plan.price = price;
    if (currency) plan.currency = currency;
    if (billingCycle) plan.billingCycle = billingCycle;
    if (trialDays !== undefined) plan.trialDays = trialDays;
    if (features) plan.features = features;
    if (isActive !== undefined) plan.isActive = isActive;

    await plan.save();

    sendSuccess(res, 'Plan updated successfully', { plan });
  } catch (error) {
    console.error('Update plan error:', error);
    sendError(res, 'Internal server error while updating plan');
  }
};

export const deletePlan = async (req, res) => {
  try {
    const { planId } = req.params;

    const plan = await Plan.findById(planId);
    if (!plan) {
      return sendError(res, 'Plan not found', 404);
    }

    await Plan.findByIdAndDelete(planId);

    sendSuccess(res, 'Plan deleted successfully');
  } catch (error) {
    console.error('Delete plan error:', error);
    sendError(res, 'Internal server error while deleting plan');
  }
};

export const getActivePlans = async (req, res) => {
  try {
    const plans = await Plan.find({ isActive: true })
      .select('name tagline price currency billingCycle trialDays features')
      .sort({ price: 1 })
      .lean();

    sendSuccess(res, 'Active plans retrieved successfully', { plans });
  } catch (error) {
    console.error('Get active plans error:', error);
    sendError(res, 'Internal server error while retrieving active plans');
  }
};
