import ApiError from '../utils/ApiError.js';

export const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const normalizeError = (error) => {
  if (error.name === 'CastError') {
    return new ApiError(400, `Invalid ${error.path}: ${error.value}`);
  }

  if (error.code === 11000) {
    const fields = Object.keys(error.keyValue || {}).join(', ');
    return new ApiError(409, `Duplicate value for ${fields || 'unique field'}`);
  }

  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((item) => item.message);
    return new ApiError(400, 'Validation failed', errors);
  }

  return error;
};

export const errorHandler = (error, req, res, next) => {
  const normalizedError = normalizeError(error);
  const statusCode = normalizedError.statusCode || 500;
  const message = normalizedError.message || 'Internal server error';

  if (process.env.NODE_ENV !== 'test') {
    console.error(normalizedError);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors: normalizedError.errors || [],
    stack: process.env.NODE_ENV === 'production' ? undefined : normalizedError.stack
  });
};
