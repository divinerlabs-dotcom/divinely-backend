// Divinely — Media Upload Handler (Phase 3)
// Handles photos, voice clips, video clips → AWS S3 ap-south-1
// Uses presigned URLs for secure direct upload from app

const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('../utils/s3Client');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

// ── Multer config — memory storage (files go straight to S3) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    const allowed = {
      photos: ['image/jpeg', 'image/png', 'image/heic', 'image/webp'],
      voice: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/m4a', 'audio/aac', 'audio/ogg'],
      video: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
    };
    const mediaType = req.params.mediaType || 'photos';
    const allowedTypes = allowed[mediaType] || allowed.photos;

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed for ${mediaType}`));
    }
  },
});

/**
 * Upload a file buffer directly to S3
 * Returns the S3 key and public-accessible URL structure
 */
async function uploadToS3(fileBuffer, fileName, mimeType, userId, mediaType) {
  const fileExt = fileName.split('.').pop();
  const s3Key = `users/${userId}/${mediaType}/${uuidv4()}.${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimeType,
    ServerSideEncryption: 'AES256', // Encrypt at rest
    Metadata: {
      userId,
      mediaType,
      originalName: fileName,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);

  return {
    s3Key,
    bucket: BUCKET_NAME,
    region: process.env.AWS_REGION || 'ap-south-1',
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Generate a presigned URL for secure temporary access
 * Used when the app needs to display uploaded media
 */
async function getPresignedUrl(s3Key, expiresInSeconds = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from S3
 * Called when user exercises data deletion rights (GDPR/Privacy Policy)
 */
async function deleteFromS3(s3Key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });
  await s3Client.send(command);
  return { deleted: true, key: s3Key };
}

module.exports = { upload, uploadToS3, getPresignedUrl, deleteFromS3 };
