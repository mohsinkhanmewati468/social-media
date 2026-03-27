const { Router } = require("express");
const multer = require("multer");
const { authenticateRequest } = require("../middleware/authMiddleware");
const logger = require("../utils/logger");
const {
  uploadMedia,
  getAllMedias,
} = require("../controllers/media-controller");

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1025,
  },
}).single("file");

router.post(
  "/upload",
  authenticateRequest,
  (req, res, next) => {
    upload(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        logger.error("Multer error while uploading: ", err);
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      } else if (err) {
        logger.error("Unknown error occurred while uploading");
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
      if (!req.file) {
        logger.error("No file found");
        return res.status(400).json({
          success: false,
          message: "No file found",
        });
      }
      next();
    });
  },
  uploadMedia,
);

router.get("/", authenticateRequest, getAllMedias);

module.exports = router;
