const Search = require("../models/Search");
const logger = require("../utils/logger");

const searchPostController = async (req, res, next) => {
  logger.info("Search endpoint called.");
  try {
    const { query } = req.query;
    const results = await Search.find(
      {
        $text: { $search: query },
      },
      {
        score: { $meta: "textScore" },
      },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(10);
    return res.json({
      success: true,
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { searchPostController };
