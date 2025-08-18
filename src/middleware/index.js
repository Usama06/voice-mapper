const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

const authenticate = (req, res, next) => {
  // Placeholder for authentication logic
  next();
};

module.exports = {
  logger,
  authenticate,
};
