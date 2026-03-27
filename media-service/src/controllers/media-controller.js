const Media = require("../models/Media");
const logger = require("../utils/logger");
const { uploadToS3 } = require("../utils/s3-helper");

const uploadMedia = async (req, res, next) => {
  logger.info("Starting media upload");
  try {
    if (!req.file) {
      logger.error("No file found");
      return res.status(400).json({
        success: false,
        message: "No file to upload",
      });
    }
    const file = req.file;
    const userId = req.user.userId;
    logger.info("Uploading to s3 starting");
    const { key, url } = await uploadToS3(file);
    const newMedia = new Media({
      key,
      url,
      mimeType: file.mimetype,
      originalname: file.originalname,
      userId,
    });
    await newMedia.save();
    logger.info("upload to s3 successfull.");
    return res.status(201).json({
      success: true,
      message: "Media uploaded succesfully.",
      url,
      mediaId: newMedia._id,
    });
  } catch (err) {
    next(err);
  }
};

const getAllMedias = async (req, res, next) => {
  try {
    const result = await Media.find();
    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { uploadMedia, getAllMedias };
