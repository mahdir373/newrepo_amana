const multer = require('multer');
const path = require('path');
const bucket = require('../config/gcs');

/* =========================
   Multer – Memory Storage
   ========================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/* =========================
   File Filters
   ========================= */
const photoFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const documentFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid document type'), false);
  }
};

/* =========================
   Upload to Google Cloud Storage
   ========================= */
const uploadToGCS = async (req, res, next) => {
  if (!req.files) return next();

  try {
    const uploaded = {};

    for (const fieldName of Object.keys(req.files)) {
      uploaded[fieldName] = [];

      for (const file of req.files[fieldName]) {
        // Decide folder by field
        let folder = 'others';
        if (fieldName === 'workPhotos') folder = 'photos';
        if (fieldName === 'deliveryCertificate') folder = 'documents';

        const fileName = `${folder}/${Date.now()}-${file.originalname}`;
        const blob = bucket.file(fileName);

        const stream = blob.createWriteStream({
          resumable: false,
          contentType: file.mimetype,
        });

        stream.end(file.buffer);

        await new Promise((resolve, reject) => {
          stream.on('finish', resolve);
          stream.on('error', reject);
        });

        uploaded[fieldName].push(
          `https://storage.googleapis.com/${bucket.name}/${fileName}`
        );
      }
    }

    req.uploadedFiles = uploaded;
    next();
  } catch (err) {
    next(err);
  }
};

/* =========================
   Fields Configuration
   ========================= */
const uploadFields = [
  {
    name: 'deliveryCertificate',
    maxCount: 1,
    filter: documentFilter
  },
  {
    name: 'workPhotos',
    maxCount: 10,
    filter: photoFilter
  }
];

/* =========================
   Middleware Wrapper
   ========================= */
const uploadMiddleware = (req, res, next) => {
  upload.fields(
    uploadFields.map(f => ({ name: f.name, maxCount: f.maxCount }))
  )(req, res, err => {
    if (err) return next(err);

    // Apply filters manually
    for (const field of uploadFields) {
      const files = req.files?.[field.name] || [];
      for (const file of files) {
        field.filter(req, file, () => {});
      }
    }

    next();
  });
};

module.exports = {
  uploadMiddleware,
  uploadToGCS
};
