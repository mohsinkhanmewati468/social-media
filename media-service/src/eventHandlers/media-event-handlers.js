const Media = require("../models/Media");
const logger = require("../utils/logger");
const { deleteFromS3 } = require("../utils/s3-helper");
const handlePostDelete = async (event) => {
  const { postId, mediaIds } = event;

  if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    logger.warn(`No mediaIds provided for post ${postId}`);
    return;
  }

  try {
    const mediaToDelete = await Media.find({
      _id: { $in: mediaIds },
    });

    if (mediaToDelete.length !== mediaIds.length) {
      logger.warn(
        `Some media not found for post ${postId}. Requested: ${mediaIds.length}, Found: ${mediaToDelete.length}`,
      );
    }

    await Promise.all(
      mediaToDelete.map(async (media) => {
        try {
          if (media.key) {
            await deleteFromS3(media.key);
          }

          await media.deleteOne();

          logger.info(`Deleted media ${media._id} for post ${postId}`);
        } catch (err) {
          logger.error(`Failed to delete media ${media._id}: ${err.message}`);
        }
      }),
    );

    logger.info(`Completed media cleanup for post ${postId}`);
  } catch (err) {
    logger.error(`Error occurred while deleting media: ${err.message}`);
  }
};

module.exports = { handlePostDelete };
