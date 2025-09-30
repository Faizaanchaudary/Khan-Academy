import User from '../models/User.js';
import Review from '../models/Review.js';
import QuestionPacket from '../models/QuestionPacket.js';
import AboutUs from '../models/AboutUs.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Get dashboard statistics
 * Returns counts for students, pending reviews, question packets, and about us sections
 */
export const getDashboardStats = async (req, res) => {
  try {
    // Get student count
    const studentCount = await User.countDocuments({ role: 'student' });

    // Get pending reviews count
    const pendingReviewsCount = await Review.countDocuments({ status: 'pending' });

    // Get question packet count
    const questionPacketCount = await QuestionPacket.countDocuments();

    // Get about us sections count and last updated date
    const aboutUsSections = await AboutUs.find({ isActive: true })
      .sort({ updatedAt: -1 })
      .select('updatedAt')
      .lean();

    const aboutUsSectionsCount = aboutUsSections.length;
    const lastAboutUsUpdate = aboutUsSections.length > 0 ? aboutUsSections[0].updatedAt : null;

    // Get additional statistics for better insights
    const totalUsers = await User.countDocuments();
    const adminCount = await User.countDocuments({ role: 'admin' });
    
    const approvedReviewsCount = await Review.countDocuments({ status: 'approved' });
    const declinedReviewsCount = await Review.countDocuments({ status: 'declined' });
    
    const activeQuestionPackets = await QuestionPacket.countDocuments({ status: 'Active' });
    const draftQuestionPackets = await QuestionPacket.countDocuments({ status: 'Draft' });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentStudents = await User.countDocuments({
      role: 'student',
      createdAt: { $gte: sevenDaysAgo }
    });

    const recentReviews = await Review.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    const recentQuestionPackets = await QuestionPacket.countDocuments({
      createdAt: { $gte: sevenDaysAgo }
    });

    // Compile dashboard statistics
    const dashboardStats = {
      overview: {
        studentCount,
        pendingReviewsCount,
        questionPacketCount,
        aboutUsSectionsCount,
        lastAboutUsUpdate
      },
      detailed: {
        users: {
          total: totalUsers,
          students: studentCount,
          admins: adminCount,
          recentRegistrations: recentStudents
        },
        reviews: {
          total: pendingReviewsCount + approvedReviewsCount + declinedReviewsCount,
          pending: pendingReviewsCount,
          approved: approvedReviewsCount,
          declined: declinedReviewsCount,
          recent: recentReviews
        },
        questionPackets: {
          total: questionPacketCount,
          active: activeQuestionPackets,
          draft: draftQuestionPackets,
          recent: recentQuestionPackets
        },
        aboutUs: {
          totalSections: aboutUsSectionsCount,
          lastUpdated: lastAboutUsUpdate
        }
      },
      recentActivity: {
        newStudents: recentStudents,
        newReviews: recentReviews,
        newQuestionPackets: recentQuestionPackets
      },
      lastUpdated: new Date()
    };

    sendSuccess(res, 'Dashboard statistics retrieved successfully', dashboardStats);
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    sendError(res, 'Internal server error while fetching dashboard statistics');
  }
};

/**
 * Get detailed user statistics
 */
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const studentCount = await User.countDocuments({ role: 'student' });
    const adminCount = await User.countDocuments({ role: 'admin' });

    // Get users by provider
    const emailUsers = await User.countDocuments({ provider: 'email' });
    const googleUsers = await User.countDocuments({ provider: 'google' });
    const appleUsers = await User.countDocuments({ provider: 'apple' });

    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get users with profile pictures
    const usersWithProfilePics = await User.countDocuments({
      profilePic: { $ne: null }
    });

    const userStats = {
      total: totalUsers,
      byRole: {
        students: studentCount,
        admins: adminCount
      },
      byProvider: {
        email: emailUsers,
        google: googleUsers,
        apple: appleUsers
      },
      recentRegistrations,
      usersWithProfilePics,
      profilePicPercentage: totalUsers > 0 ? Math.round((usersWithProfilePics / totalUsers) * 100) : 0
    };

    sendSuccess(res, 'User statistics retrieved successfully', userStats);
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    sendError(res, 'Internal server error while fetching user statistics');
  }
};

/**
 * Get detailed review statistics
 */
export const getReviewStats = async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const pendingReviews = await Review.countDocuments({ status: 'pending' });
    const approvedReviews = await Review.countDocuments({ status: 'approved' });
    const declinedReviews = await Review.countDocuments({ status: 'declined' });

    // Get average rating
    const ratingStats = await Review.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const averageRating = ratingStats.length > 0 ? ratingStats[0].averageRating : 0;
    const totalRatings = ratingStats.length > 0 ? ratingStats[0].totalRatings : 0;

    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { status: 'approved' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const reviewStats = {
      total: totalReviews,
      byStatus: {
        pending: pendingReviews,
        approved: approvedReviews,
        declined: declinedReviews
      },
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings,
      ratingDistribution: ratingDistribution.reduce((acc, item) => {
        acc[`rating_${item._id}`] = item.count;
        return acc;
      }, {})
    };

    sendSuccess(res, 'Review statistics retrieved successfully', reviewStats);
  } catch (error) {
    console.error('Error fetching review statistics:', error);
    sendError(res, 'Internal server error while fetching review statistics');
  }
};

/**
 * Get detailed question packet statistics
 */
export const getQuestionPacketStats = async (req, res) => {
  try {
    const totalPackets = await QuestionPacket.countDocuments();
    const activePackets = await QuestionPacket.countDocuments({ status: 'Active' });
    const draftPackets = await QuestionPacket.countDocuments({ status: 'Draft' });

    // Get packets by subject category
    const packetsBySubject = await QuestionPacket.aggregate([
      {
        $group: {
          _id: '$subjectCategory',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get packets by difficulty level
    const packetsByDifficulty = await QuestionPacket.aggregate([
      {
        $group: {
          _id: '$difficultyLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get average questions per packet
    const avgQuestionsStats = await QuestionPacket.aggregate([
      {
        $group: {
          _id: null,
          averageQuestions: { $avg: '$numberOfQuestions' },
          totalQuestions: { $sum: '$numberOfQuestions' }
        }
      }
    ]);

    const averageQuestions = avgQuestionsStats.length > 0 ? 
      Math.round(avgQuestionsStats[0].averageQuestions * 10) / 10 : 0;
    const totalQuestions = avgQuestionsStats.length > 0 ? avgQuestionsStats[0].totalQuestions : 0;

    const questionPacketStats = {
      total: totalPackets,
      byStatus: {
        active: activePackets,
        draft: draftPackets
      },
      bySubject: packetsBySubject.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byDifficulty: packetsByDifficulty.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      averageQuestions,
      totalQuestions
    };

    sendSuccess(res, 'Question packet statistics retrieved successfully', questionPacketStats);
  } catch (error) {
    console.error('Error fetching question packet statistics:', error);
    sendError(res, 'Internal server error while fetching question packet statistics');
  }
};
