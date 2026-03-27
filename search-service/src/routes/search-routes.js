const { Router } = require("express");
const { searchPostController } = require("../controllers/search-controller");
const { authenticateRequest } = require("../middleware/authMiddleware");

const router = Router();
router.use(authenticateRequest);
router.get("/posts", searchPostController);

module.exports = router;
