const DailyLog = require('../models/dailyLog.model');
const bucket = require('../config/gcs');

/* =================================================
   Upload files (photos + delivery certificate)
   Endpoint: POST /api/uploads/:logId/files
================================================= */
exports.uploadFiles = async (req, res) => {
  try {
    const { logId } = req.params;

    if (!req.uploadedFiles || Object.keys(req.uploadedFiles).length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const log = await DailyLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    // 🔐 Authorization
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to upload files to this log',
      });
    }

    // 🚫 Approved check
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Cannot upload files to an approved log',
      });
    }

    /* -------- Photos -------- */
    if (req.uploadedFiles.workPhotos?.length) {
      const photos = req.uploadedFiles.workPhotos.map((url) => ({
        url,
        uploadedAt: new Date(),
      }));

      log.photos = [...(log.photos || []), ...photos];
    }

    /* -------- Delivery Certificate -------- */
    if (req.uploadedFiles.deliveryCertificate?.length) {
      log.deliveryCertificate = {
        url: req.uploadedFiles.deliveryCertificate[0],
        type: req.body.type || 'delivery_note',
        uploadedAt: new Date(),
      };
    }

    await log.save();

    return res.status(200).json({
      message: 'Files uploaded successfully',
      uploadedFiles: req.uploadedFiles,
    });
  } catch (error) {
    console.error('❌ Upload files error:', error);
    return res.status(500).json({
      message: error.message || 'Error uploading files',
    });
  }
};

/* =================================================
   Delete file (photo or delivery certificate)
   Endpoint: DELETE /api/uploads/:logId/:fileType/:fileId
================================================= */
exports.deleteFile = async (req, res) => {
  try {
    const { logId, fileType, fileId } = req.params;

    if (!['workPhotos', 'deliveryCertificate'].includes(fileType)) {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const log = await DailyLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    // 🔐 Authorization
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to delete files from this log',
      });
    }

    // 🚫 Approved check
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Cannot delete files from an approved log',
      });
    }

    let fileUrl;

    /* -------- Delete photo -------- */
    if (fileType === 'workPhotos') {
      const index = log.photos.findIndex(
        (p) => p._id.toString() === fileId
      );

      if (index === -1) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      fileUrl = log.photos[index].url;
      log.photos.splice(index, 1);
    }

    /* -------- Delete delivery certificate -------- */
    if (fileType === 'deliveryCertificate') {
      if (!log.deliveryCertificate) {
        return res.status(404).json({ message: 'Delivery certificate not found' });
      }

      fileUrl = log.deliveryCertificate.url;
      log.deliveryCertificate = null;
    }

    /* -------- Delete from GCS -------- */
    if (fileUrl) {
      const gcsPath = decodeURIComponent(
        fileUrl.split(`https://storage.googleapis.com/${bucket.name}/`)[1]
      );
      await bucket.file(gcsPath).delete().catch(() => {});
    }

    await log.save();

    return res.status(200).json({
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('❌ Delete file error:', error);
    return res.status(500).json({
      message: error.message || 'Error deleting file',
    });
  }
};
