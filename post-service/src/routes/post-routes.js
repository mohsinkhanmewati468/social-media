const { Router } = require("express");
const {
  createPost,
  getAllPosts,
  getPost,
  deletePost,
} = require("../controllers/post-controller");
const { authenticateRequest } = require("../middleware/authMiddleware");

const router = Router();

router.use(authenticateRequest);

router.post("/create-post", createPost);
router.get("/get-posts", getAllPosts);
router.get("/:id", getPost);
router.delete("/:id", deletePost);
module.exports = router;
