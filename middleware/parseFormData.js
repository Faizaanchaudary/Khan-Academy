/**
 * Middleware to parse JSON strings from FormData
 * This is needed because FormData sends complex data as JSON strings
 */
export const parseFormData = (req, res, next) => {
  // Only process if body exists and has potential JSON strings
  if (req.body && typeof req.body === 'object') {
    // Parse options if it's a JSON string
    if (req.body.options && typeof req.body.options === 'string') {
      try {
        req.body.options = JSON.parse(req.body.options);
      } catch (error) {
        // If parsing fails, leave it as is and let validation handle it
        console.error('Failed to parse options JSON:', error);
      }
    }

    // Parse level if it's a string
    if (req.body.level && typeof req.body.level === 'string') {
      const parsed = parseInt(req.body.level, 10);
      if (!isNaN(parsed)) {
        req.body.level = parsed;
      }
    }

    // Parse correctAnswerIndex if it's a string
    if (req.body.correctAnswerIndex !== undefined && typeof req.body.correctAnswerIndex === 'string') {
      const parsed = parseInt(req.body.correctAnswerIndex, 10);
      if (!isNaN(parsed)) {
        req.body.correctAnswerIndex = parsed;
      }
    }
  }

  next();
};

