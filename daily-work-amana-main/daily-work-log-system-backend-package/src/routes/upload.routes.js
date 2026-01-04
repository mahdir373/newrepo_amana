const express = require('express');
const uploadController = require('../controllers/upload.controller');
const {
  verifyToken,
  isManagerOrTeamLeader,
} = require('../middleware/auth.middleware');
const {
  uploadMiddleware,
  uploadToGCS,
} = require('../middleware/upload.middleware');

const router = express.Router();

/* ------------------------------------
   🔐 Authentication
------------------------------------ */
router.use(verifyToken);

/* ------------------------------------
   📤 Upload files to a daily log
   Endpoint: POST /api/uploads/:logId/files

   Supported fields (multipart/form-data):
   - workPhotos (up to 10 images)
   - deliveryCertificate (1 document)
------------------------------------ */
router.post(
  '/:logId/files',
  isManagerOrTeamLeader,
  uploadMiddleware, // multer.memoryStorage + validation
  uploadToGCS,      // upload files to Google Cloud Storage
  uploadController.uploadFiles
);

/* ------------------------------------
   🗑️ Delete file from a daily log
   Endpoint: DELETE /api/uploads/:logId/:fileType/:fileId

   fileType:
   - workPhotos
   - deliveryCertificate
------------------------------------ */
router.delete(
  '/:logId/:fileType/:fileId',
  isManagerOrTeamLeader,
  uploadController.deleteFile
);

module.exports = router;
