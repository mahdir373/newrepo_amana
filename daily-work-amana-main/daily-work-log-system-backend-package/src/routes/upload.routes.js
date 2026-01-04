const express = require('express');
const uploadController = require('../controllers/upload.controller');
const { verifyToken, isManagerOrTeamLeader } = require('../middleware/auth.middleware');
const {
  uploadMiddleware,
  uploadToGCS
} = require('../middleware/upload.middleware');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * Upload photos + documents to a daily log
 * Fields:
 * - workPhotos (up to 10 images)
 * - deliveryCertificate (1 document)
 */
router.post(
  '/:logId/files',
  isManagerOrTeamLeader,
  uploadMiddleware,   // multer.memoryStorage
  uploadToGCS,        // upload to Google Cloud Storage
  uploadController.uploadFiles
);

// Delete a file (photo or document)
router.delete(
  '/:logId/:fileType/:fileId',
  isManagerOrTeamLeader,
  uploadController.deleteFile
);

module.exports = router;
