const jwt = require('jsonwebtoken');

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET, // secret pour access token
    { expiresIn: '1h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user._id || user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET, // secret pour refresh token
    { expiresIn: '7d' }
  );
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

const refreshAccessToken = (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken);
  return generateAccessToken(payload);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
};
