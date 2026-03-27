const logger = require("../utils/logger");
const errorHandler = require("../middleware/errorHandler");
const { validateRegistration, validateLogin } = require("../utils/validation");
const User = require("../models/User");
const generateTokens = require("../utils/generateToken");
const RefreshToken = require("../models/RefreshToken");

const registerUser = async (req, res, next) => {
  logger.info("Registration endpoint called.");
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Inputs are required.",
      });
    }
    const { error } = validateRegistration(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { username, email, password } = req.body;
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      logger.warn("User already exists");
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }
    user = new User({ username, email, password });
    await user.save();
    logger.log("User saved successfully.", user._id);
    const { accessToken, refreshToken } = await generateTokens(user);
    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

const loginUser = async (req, res, next) => {
  logger.info("Login endpoint called.");
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Inputs are required.",
      });
    }
    const { error } = validateLogin(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn("Invalid user");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      logger.warn("Invalid password");
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }
    const { accessToken, refreshToken } = await generateTokens(user);
    return res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

const refreshTokenUser = async (req, res, next) => {
  logger.info("RefreshToken api called.");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh token missing",
      });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken || storedToken.expiresAt < new Date()) {
      logger.warn("Invalid or expired refresh token");
      return res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
    }
    const user = await User.findById(storedToken.user);
    if (!user) {
      logger.warn("User not found.");
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await generateTokens(user);
    await storedToken.deleteOne();
    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    next(err);
  }
};

const logoutUser = async (req, res, next) => {
  logger.info("Logout api called.");
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      logger.warn("Refresh token missing");
      return res.status(400).json({
        success: false,
        message: "Refresh token missing",
      });
    }
    await RefreshToken.deleteOne({ token: refreshToken });
    logger.info("Refresh token deleted for logout");
    return res.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { registerUser, loginUser, refreshTokenUser, logoutUser };
