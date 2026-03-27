require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const errorHandler = require("./middleware/errorHandler");
const logger = require("./utils/logger");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const searchRoutes = require("./routes/search-routes");
const {
  handlePostCreated,
  handlePostDeleted,
} = require("./eventHandlers/search-event-handlers");
const app = express();
const PORT = process.env.PORT || 3004;

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => logger.info("Connected to db"))
  .catch((err) => logger.error("Mongodb connection error", err));

app.use(express.json());
app.use(helmet());
app.use(cors());
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request Body : ${req.body}`);
  next();
});

app.use("/api/search", searchRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();
    await consumeEvent("post.created", handlePostCreated);
    await consumeEvent("post.deleted", handlePostDeleted);
    app.listen(PORT, () => {
      console.log(`Search service is listening on port ${PORT}`);
    });
  } catch (err) {
    logger.error("Error in starting server", err);
    process.exit(1);
  }
}

startServer();

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`unhandled Rejection at ${promise} , reason : ${reason}`);
});
