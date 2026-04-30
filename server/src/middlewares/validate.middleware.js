import ApiError from '../utils/ApiError.js';

const validate = (schema) => (req, res, next) => {
  const { value, error } = schema.validate(
    {
      body: req.body,
      params: req.params,
      query: req.query
    },
    {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: true
    }
  );

  if (error) {
    const errors = error.details.map((detail) => detail.message);
    next(new ApiError(400, 'Request validation failed', errors));
    return;
  }

  req.body = value.body || req.body;
  req.params = value.params || req.params;
  req.query = value.query || req.query;
  next();
};

export default validate;
