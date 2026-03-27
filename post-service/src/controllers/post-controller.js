const { default: mongoose } = require("mongoose");
const Post = require("../models/Post");
const logger = require("../utils/logger");
const { validateCreatePost } = require("../utils/validation");
const { publishEvent } = require("../utils/rabbitmq");

async function invalidatePostCache(req, input) {
  const cachedKey = `post:${input}`;
  await req.redisClient.del(cachedKey);
  const keys = await req.redisClient.keys("posts:*");
  if (keys.length > 0) {
    await req.redisClient.del(keys);
  }
}

const createPost = async (req, res, next) => {
  logger.info("Create post endpoint called");
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Inputs are required.",
      });
    }
    const { error } = validateCreatePost(req.body);
    if (error) {
      logger.warn("Validation error", error.details[0].message);
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }
    const { content, mediaIds } = req.body;
    const newPost = new Post({
      user: req.user.userId,
      content,
      mediaIds: mediaIds || [],
    });
    await newPost.save();
    await publishEvent("post.created", {
      userId: newPost.user.toString(),
      postId: newPost._id.toString(),
      content: newPost.content,
    });
    await invalidatePostCache(req, newPost._id.toString());
    logger.info("Post created successfully");
    return res.status(201).json({
      success: true,
      message: "Post created successfully",
    });
  } catch (err) {
    next(err);
  }
};

const getAllPosts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = parseInt(req.query.limit || 10);
    const startIndex = (page - 1) * limit;

    const cacheKey = `posts:${page}:${limit}`;
    const cachedPosts = await req.redisClient.get(cacheKey);
    if (cachedPosts) {
      return res.json({
        success: true,
        ...JSON.parse(cachedPosts),
      });
    }
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit);

    const totalPostsCount = await Post.countDocuments();
    const result = {
      posts,
      currentPage: page,
      limit,
      totalPages: Math.ceil(totalPostsCount / limit),
      totalPostsCount,
    };

    await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

const getPost = async (req, res, next) => {
  logger.info("Get post api called");
  try {
    const postId = req.params.id;
    const cacheKey = `post:${postId}`;
    const cachedPost = await req.redisClient.get(cacheKey);
    if (cachedPost) {
      return res.json({
        success: true,
        data: JSON.parse(cachedPost),
      });
    }
    const post = await Post.findById(postId);
    await req.redisClient.setex(cacheKey, 3600, JSON.stringify(post));
    return res.json({
      success: true,
      data: post,
    });
  } catch (err) {
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  logger.info("Delete post api called");
  try {
    const postId = req.params.id;
    const post = await Post.findByIdAndDelete(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found.",
      });
    }

    ////////publish post delete method->
    await publishEvent("post.deleted", {
      postId: postId.toString(),
      userId: req.user.userId,
      mediaIds: post.mediaIds,
    });

    await invalidatePostCache(req, postId);
    return res.json({
      success: true,
      message: "Post deleted successfully.",
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { createPost, getAllPosts, getPost, deletePost };
