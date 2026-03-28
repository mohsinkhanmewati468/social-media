require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Redis = require("ioredis");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const logger = require("./utils/logger");
const proxy = require("express-http-proxy");
const errorHandler = require("./middleware/errorHandler");
const { validateToken } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Redis client
const redisClient = new Redis(process.env.REDIS_URL);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request Body: ${JSON.stringify(req.body)}`);
  next();
});

// Helper delay (for minor retry buffer)
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Proxy options (COMMON)
const proxyOptions = {
  proxyReqPathResolver: (req) => {
    return req.originalUrl.replace(/^\/v1\//, "/api/");
  },

  // ✅ FIXED ERROR HANDLER
  proxyErrorHandler: async (err, res, next) => {
    logger.error(`Proxy error: ${err.message}`);

    await delay(500); // small buffer (helps when service just started)

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Service temporarily unavailable",
      });
    }
  },
};

// ================= AUTH SERVICE =================
app.use(
  "/v1/auth",
  proxy(process.env.IDENTITY_SERVICE_URL, {
    ...proxyOptions,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Identity service: ${proxyRes.statusCode}`);
      return proxyResData.toString("utf8");
    },
  }),
);

// ================= POST SERVICE =================
app.use(
  "/v1/posts",
  validateToken,
  proxy(process.env.POST_SERVICE_URL, {
    ...proxyOptions,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Post service: ${proxyRes.statusCode}`);
      return proxyResData.toString("utf8");
    },
  }),
);

// ================= MEDIA SERVICE =================
app.use(
  "/v1/media",
  validateToken,
  proxy(process.env.MEDIA_SERVICE_URL, {
    ...proxyOptions,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;

      const contentType = srcReq.headers["content-type"];

      if (!contentType || !contentType.startsWith("multipart/form-data")) {
        proxyReqOpts.headers["Content-Type"] = "application/json";
      }

      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Media service: ${proxyRes.statusCode}`);
      return proxyResData;
    },

    parseReqBody: false,
  }),
);

// ================= SEARCH SERVICE =================
app.use(
  "/v1/search",
  validateToken,
  proxy(process.env.SEARCH_SERVICE_URL, {
    ...proxyOptions,

    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      proxyReqOpts.headers["Content-Type"] = "application/json";
      proxyReqOpts.headers["x-user-id"] = srcReq.user.userId;
      return proxyReqOpts;
    },

    userResDecorator: (proxyRes, proxyResData) => {
      logger.info(`Response from Search service: ${proxyRes.statusCode}`);
      return proxyResData;
    },
  }),
);

// ================= RATE LIMIT =================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many requests",
    });
  },

  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use(apiLimiter);

// ================= ERROR HANDLER =================
app.use(errorHandler);

// ================= START SERVER =================
app.listen(PORT, () => {
  logger.info(`API Gateway running on port ${PORT}`);
  logger.info(`Identity: ${process.env.IDENTITY_SERVICE_URL}`);
  logger.info(`Post: ${process.env.POST_SERVICE_URL}`);
  logger.info(`Media: ${process.env.MEDIA_SERVICE_URL}`);
  logger.info(`Search: ${process.env.SEARCH_SERVICE_URL}`);
});
