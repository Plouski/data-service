const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,  // <-- Doit exister
    { expiresIn: '1h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id
    },
    process.env.JWT_REFRESH_SECRET, // <-- Doit exister
    { expiresIn: '7d' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken
};