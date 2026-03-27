require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const helmet = require("helmet");
const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");
const mediaRoutes = require("./routes/media-routes");
const { connectToRabbitMQ, consumeEvent } = require("./utils/rabbitmq");
const { handlePostDelete } = require("./eventHandlers/media-event-handlers");

const app = express();
const PORT = process.env.PORT || 3003;

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => logger.info("Connected to db"))
  .catch((err) => logger.error("Mongodb connection error", e));

app.use(cors());
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  logger.info(`Request Body : ${req.body}`);
  next();
});

app.use("/api/media", mediaRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectToRabbitMQ();
    /////////Consume all the events/////////
    await consumeEvent("post.deleted", handlePostDelete);
    app.listen(PORT, () => {
      console.log(`Media service is listening on port ${PORT}`);
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
