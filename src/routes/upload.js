// Divinely — Upload Routes (Phase 3)
// POST /api/upload/:mediaType
// Accepts: photos, voice, video

const express = require('express');
const router = express.Router();
const { upload, uploadToS3 } = require('../handlers/mediaUploadHandler');

// POST /api/upload/photos
// POST /api/upload/voice
// POST /api/upload/video
router.post('/:mediaType', (req, res, next) => {
  const { mediaType } = req.params;
  const validTypes = ['photos', 'voice', 'video'];

  if (!validTypes.includes(mediaType)) {
    return res.status(400).json({ error: `Invalid media type. Use: ${validTypes.join(', ')}` });
  }

  // Use multer to handle the file upload
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';

      const result = await uploadToS3(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        mediaType
      );

      console.log(`[Upload] ${mediaType} uploaded for user ${userId}: ${result.s3Key}`);

      res.status(201).json({
        success: true,
        mediaType,
        file: {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          s3Key: result.s3Key,
          uploadedAt: result.uploadedAt,
        },
        message: `${mediaType} uploaded successfully`,
      });

    } catch (uploadError) {
      console.error('[Upload Error]', uploadError);
      res.status(500).json({ error: 'Upload failed. Check AWS credentials.' });
    }
  });
});

// POST /api/upload/batch — upload multiple files at once
router.post('/batch/:mediaType', (req, res, next) => {
  const { mediaType } = req.params;

  upload.array('files', 10)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    try {
      const userId = req.body.userId || req.headers['x-user-id'] || 'anonymous';
      const results = [];

      for (const file of req.files) {
        const result = await uploadToS3(
          file.buffer,
          file.originalname,
          file.mimetype,
          userId,
          mediaType
        );
        results.push({
          originalName: file.originalname,
          size: file.size,
          s3Key: result.s3Key,
          uploadedAt: result.uploadedAt,
        });
      }

      res.status(201).json({
        success: true,
        mediaType,
        uploaded: results.length,
        files: results,
      });

    } catch (uploadError) {
      console.error('[Batch Upload Error]', uploadError);
      res.status(500).json({ error: 'Batch upload failed.' });
    }
  });
});

module.exports = router;
