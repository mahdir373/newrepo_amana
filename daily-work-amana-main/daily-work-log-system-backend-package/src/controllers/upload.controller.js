const DailyLog = require('../models/dailyLog.model');
const bucket = require('../config/gcs');

/**
 * Upload photos to a daily log (Google Cloud Storage)
 */


exports.uploadFiles = async (req, res) => {
  try {
    // פשוט להפנות ללוגיקה קיימת
    if (req.uploadedFiles?.workPhotos) {
      return exports.uploadPhotos(req, res);
    }

    if (req.uploadedFiles?.deliveryCertificate) {
      return exports.uploadDocuments(req, res);
    }

    return res.status(400).json({ message: 'No files uploaded' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};



exports.uploadPhotos = async (req, res) => {
  try {
    if (
      !req.uploadedFiles ||
      !req.uploadedFiles.workPhotos ||
      req.uploadedFiles.workPhotos.length === 0
    ) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const log = await DailyLog.findById(req.params.logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    // Authorization
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to upload photos to this log'
      });
    }

    // Approved check
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Cannot upload photos to an approved log'
      });
    }

    // Save photo URLs
    const photos = req.uploadedFiles.workPhotos.map(url => ({
      url,
      uploadedAt: new Date()
    }));

    log.photos = [...log.photos, ...photos];
    await log.save();

    return res.status(200).json({
      message: 'Photos uploaded successfully',
      photos
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while uploading photos'
    });
  }
};

/**
 * Upload documents to a daily log (Google Cloud Storage)
 */
exports.uploadDocuments = async (req, res) => {
  try {
    if (
      !req.uploadedFiles ||
      !req.uploadedFiles.deliveryCertificate ||
      req.uploadedFiles.deliveryCertificate.length === 0
    ) {
      return res.status(400).json({ message: 'No documents uploaded' });
    }

    const log = await DailyLog.findById(req.params.logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    // Authorization
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: 'You are not authorized to upload documents to this log'
      });
    }

    // Approved check
    if (log.status === 'approved') {
      return res.status(400).json({
        message: 'Cannot upload documents to an approved log'
      });
    }

    // Only one delivery certificate expected
    const documentUrl = req.uploadedFiles.deliveryCertificate[0];

    log.deliveryCertificate = {
      url: documentUrl,
      type: req.body.type || 'other',
      uploadedAt: new Date()
    };

    await log.save();

    return res.status(200).json({
      message: 'Documents uploaded successfully',
      document: log.deliveryCertificate
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while uploading documents'
    });
  }
};

/**
 * Delete a photo or document (from GCS + DB)
 */
exports.deleteFile = async (req, res) => {
  try {
    const { logId, fileType, fileId } = req.params;

    if (fileType !== 'photos' && fileType !== 'documents') {
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const log = await DailyLog.findById(logId);
    if (!log) {
      return res.status(404).json({ message: 'Log not found' });
    }

    // Authorization
    if (req.userRole !== 'Manager' && log.teamLeader.toString() !== req.userId) {
      return res.status(403).json({
        message: `You are not authorized to delete ${fileType} from this log`
      });
    }

    // Approved check
    if (log.status === 'approved') {
      return res.status(400).json({
        message: `Cannot delete ${fileType} from an approved log`
      });
    }

    let fileUrl;

    if (fileType === 'photos') {
      const index = log.photos.findIndex(
        f => f._id.toString() === fileId
      );
      if (index === -1) {
        return res.status(404).json({ message: 'Photo not found' });
      }

      fileUrl = log.photos[index].url;
      log.photos.splice(index, 1);
    } else {
      if (!log.deliveryCertificate) {
        return res.status(404).json({ message: 'Document not found' });
      }

      fileUrl = log.deliveryCertificate.url;
      log.deliveryCertificate = null;
    }

    // Delete from Google Cloud Storage
    const gcsPath = decodeURIComponent(
      fileUrl.split(`https://storage.googleapis.com/${bucket.name}/`)[1]
    );
    await bucket.file(gcsPath).delete();

    await log.save();

    return res.status(200).json({
      message: 'File deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Some error occurred while deleting the file'
    });
  }
};
