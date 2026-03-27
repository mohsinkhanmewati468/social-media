require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const logger = require("./utils/logger");
const helmet = require("helmet");
const cors = require("cors");
const { RateLimiterRedis } = require("rate-limiter-flexible");
const Redis = require("ioredis");
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const routes = require("./routes/identity-service");
const errorHandler = require("./middleware/errorHandler");
const app = express();

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => logger.info("Connected to db"))
  .catch((err) => logger.error("Mongodb connection error", err));

const redisClient = new Redis(process.env.REDIS_URL);
const PORT = process.env.PORT;

app.use(express.json());
app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request Body : ${req.body}`);
  next();
});

const rateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: "middleware",
  points: 10,
  duration: 1,
});

app.use((req, res, next) => {
  rateLimiter
    .consume(req.ip)
    .then(() => next())
    .catch((err) => {
      logger.warn(`Rate limit execeeded for IP : ${req.ip}`);
      res.status(429).json({
        success: false,
        message: "Too many request",
      });
    });
});

const sensitiveEndpointsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP : ${req.ip}`);
    res.status(429).json({
      success: false,
      message: "Too many request",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.call(...args),
  }),
});

app.use("/api/auth/register", sensitiveEndpointsLimiter);

app.use("/api/auth", routes);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Identity service is listening on port ${PORT}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`unhandled Rejection at ${promise} , reason : ${reason}`);
});
