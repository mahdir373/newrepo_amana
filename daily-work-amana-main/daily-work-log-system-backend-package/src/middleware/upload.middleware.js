const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bucket = require('../config/gcs');

/* =========================
   Multer – Memory Storage
   ========================= */
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 📸 תמונות
    if (file.fieldname === 'workPhotos') {
      if (file.mimetype.startsWith('image/')) {
        return cb(null, true);
      }
      return cb(new Error('Only image files are allowed for workPhotos'));
    }

    // 📄 מסמכים
    if (file.fieldname === 'deliveryCertificate') {
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif',
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        return cb(null, true);
      }
      return cb(new Error('Invalid document type for deliveryCertificate'));
    }

    cb(new Error('Unknown upload field'));
  },
}).fields([
  { name: 'deliveryCertificate', maxCount: 1 },
  { name: 'workPhotos', maxCount: 10 },
]);

/* =========================
   Upload to Google Cloud Storage
   ========================= */
const uploadToGCS = async (req, res, next) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      req.uploadedFiles = {};
      return next();
    }

    req.uploadedFiles = {};

    const uploadSingleFile = (file, folder) =>
      new Promise((resolve, reject) => {
        const fileName = `${folder}/${uuidv4()}-${file.originalname}`;
        const blob = bucket.file(fileName);

        const stream = blob.createWriteStream({
          resumable: false,
          contentType: file.mimetype,
          metadata: {
            cacheControl: 'public, max-age=31536000',
          },
        });

        stream.on('error', reject);

        stream.on('finish', async () => {
          try {
            await blob.makePublic();
            resolve(
              `https://storage.googleapis.com/${bucket.name}/${fileName}`
            );
          } catch (err) {
            reject(err);
          }
        });

        stream.end(file.buffer);
      });

    // 📄 deliveryCertificate
    if (req.files.deliveryCertificate?.length) {
      req.uploadedFiles.deliveryCertificate = [];
      for (const file of req.files.deliveryCertificate) {
        const url = await uploadSingleFile(file, 'delivery-certificates');
        req.uploadedFiles.deliveryCertificate.push(url);
      }
    }

    // 📸 workPhotos
    if (req.files.workPhotos?.length) {
      req.uploadedFiles.workPhotos = [];
      for (const file of req.files.workPhotos) {
        const url = await uploadSingleFile(file, 'work-photos');
        req.uploadedFiles.workPhotos.push(url);
      }
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  uploadMiddleware,
  uploadToGCS,
};
