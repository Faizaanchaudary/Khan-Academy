import Review from '../models/Review.js';
import User from '../models/User.js';

export const addReview = async (req, res) => {
  try {
    const { rating, title, comment, adminId } = req.body;
    const studentId = req.user._id;

    // Check if user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can submit reviews'
      });
    }

    // Validate that the adminId exists and is actually an admin
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    if (admin.role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Selected user is not an admin'
      });
    }

    const review = await Review.create({
      studentId,
      adminId,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      status: 'pending'
    });

    // Populate student and admin details
    await review.populate('studentId', 'firstName lastName profilePic');
    await review.populate('adminId', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: {
        review
      }
    });
  } catch (error) {
    console.error('Add review error:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid admin ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while submitting review'
    });
  }
};

export const getReviews = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view reviews'
      });
    }

    // Only show reviews for this specific admin
    const query = { status, adminId };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate('studentId', 'firstName lastName profilePic')
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalReviews: total,
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving reviews'
    });
  }
};

export const approveReview = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve reviews'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if this review is assigned to this admin
    if (review.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only approve reviews assigned to you'
      });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Review has already been processed'
      });
    }

    review.status = 'approved';
    review.approvedAt = new Date();
    await review.save();

    // Populate details
    await review.populate('studentId', 'firstName lastName profilePic');
    await review.populate('adminId', 'firstName lastName');

    res.json({
      success: true,
      message: 'Review approved successfully',
      data: {
        review
      }
    });
  } catch (error) {
    console.error('Approve review error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while approving review'
    });
  }
};

export const declineReview = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can decline reviews'
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found'
      });
    }

    // Check if this review is assigned to this admin
    if (review.adminId.toString() !== adminId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only decline reviews assigned to you'
      });
    }

    if (review.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Review has already been processed'
      });
    }

    review.status = 'declined';
    review.declinedAt = new Date();
    await review.save();

    // Populate details
    await review.populate('studentId', 'firstName lastName profilePic');
    await review.populate('adminId', 'firstName lastName');

    res.json({
      success: true,
      message: 'Review declined successfully',
      data: {
        review
      }
    });
  } catch (error) {
    console.error('Decline review error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID format'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while declining review'
    });
  }
};

export const getStudentReviews = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    // Check if user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view their own reviews'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find({ studentId })
      .populate('studentId', 'firstName lastName profilePic')
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments({ studentId });

    res.json({
      success: true,
      message: 'Student reviews retrieved successfully',
      data: {
        reviews,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalReviews: total,
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get student reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving student reviews'
    });
  }
};

export const getAdmins = async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({
        success: false,
        message: 'Only students can view admin list'
      });
    }

    const admins = await User.find({ role: 'admin' })
      .select('_id firstName lastName profilePic')
      .sort({ firstName: 1 });

    res.json({
      success: true,
      message: 'Admins retrieved successfully',
      data: {
        admins
      }
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving admins'
    });
  }
};

export const getReviewsByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view reviews'
      });
    }

    // Validate status parameter
    const validStatuses = ['pending', 'approved', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, approved, declined'
      });
    }

    // Only show reviews for this specific admin
    const query = { status, adminId };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate('studentId', 'firstName lastName profilePic')
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      message: `${status.charAt(0).toUpperCase() + status.slice(1)} reviews retrieved successfully`,
      data: {
        reviews,
        status,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalReviews: total,
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get reviews by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving reviews by status'
    });
  }
};

export const getReviewCounts = async (req, res) => {
  try {
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view review counts'
      });
    }

    // Get counts for each status
    const [pendingCount, approvedCount, declinedCount] = await Promise.all([
      Review.countDocuments({ status: 'pending', adminId }),
      Review.countDocuments({ status: 'approved', adminId }),
      Review.countDocuments({ status: 'declined', adminId })
    ]);

    const totalCount = pendingCount + approvedCount + declinedCount;

    res.json({
      success: true,
      message: 'Review counts retrieved successfully',
      data: {
        counts: {
          pending: pendingCount,
          approved: approvedCount,
          declined: declinedCount,
          total: totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get review counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving review counts'
    });
  }
};

export const getAllReviewsWithCounts = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    const adminId = req.user._id;

    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view reviews'
      });
    }

    // Validate status parameter
    const validStatuses = ['pending', 'approved', 'declined'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: pending, approved, declined'
      });
    }

    // Get counts for all statuses
    const [pendingCount, approvedCount, declinedCount] = await Promise.all([
      Review.countDocuments({ status: 'pending', adminId }),
      Review.countDocuments({ status: 'approved', adminId }),
      Review.countDocuments({ status: 'declined', adminId })
    ]);

    const totalCount = pendingCount + approvedCount + declinedCount;

    // Get reviews for the requested status
    const query = { status, adminId };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate('studentId', 'firstName lastName profilePic')
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      message: 'Reviews and counts retrieved successfully',
      data: {
        reviews,
        currentStatus: status,
        counts: {
          pending: pendingCount,
          approved: approvedCount,
          declined: declinedCount,
          total: totalCount
        },
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalReviews: total,
          hasNextPage: skip + reviews.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all reviews with counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while retrieving reviews with counts'
    });
  }
};
