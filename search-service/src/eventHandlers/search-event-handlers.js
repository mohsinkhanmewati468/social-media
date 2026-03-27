const logger = require("../utils/logger");
const Search = require("../models/Search");
async function handlePostCreated(event) {
  try {
    const { postId, userId, content } = event;
    const newSearchPost = new Search({
      postId,
      userId,
      content,
    });
    await newSearchPost.save();
    logger.info(`Search post created : ${postId}, ${newSearchPost._id}`);
  } catch (err) {
    logger.error(`Error handling post creation event`, err);
  }
}

async function handlePostDeleted(event) {
  try {
    const { postId } = event;
    await Search.deleteOne({ postId });
    logger.info(`Deleted post: ${postId}`);
  } catch (err) {
    logger.error(`Error handling post creation event`, err);
  }
}

module.exports = { handlePostCreated, handlePostDeleted };
