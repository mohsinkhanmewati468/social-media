const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3 = require("./s3");
const logger = require("./logger");

const uploadToS3 = async (file) => {
  try {
    const fileName = `${Date.now()}-${file.originalname}`;

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    // Upload file
    await s3.send(new PutObjectCommand(params));

    // Generate signed URL (GET)
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
    });

    const signedUrl = await getSignedUrl(s3, command, {
      expiresIn: 60 * 60, // 1 hour
    });

    return {
      key: fileName,
      url: signedUrl, // return signed URL
    };
  } catch (error) {
    logger.error("S3 Upload Error:", error);
    throw new Error("Failed to upload file to S3");
  }
};

const deleteFromS3 = async (key) => {
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key, // fileName stored in DB
    };

    await s3.send(new DeleteObjectCommand(params));

    return {
      success: true,
      message: "File deleted successfully",
    };
  } catch (error) {
    logger.error("S3 Delete Error:", error);
    throw new Error("Failed to delete file from S3");
  }
};

module.exports = { uploadToS3, deleteFromS3 };
