require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initScheduledTasks } = require('./utils/scheduler');

// 🔹 Google Cloud Storage
const bucket = require('./config/gcs');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectRoutes = require('./routes/project.routes');
const logRoutes = require('./routes/log.routes');
const uploadRoutes = require('./routes/upload.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

/* ------------------------------------
   Security & middleware
------------------------------------ */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

/* ------------------------------------
   Health check (Cloud Run)
------------------------------------ */
app.get('/healthz', (req, res) => {
  res.status(200).send('ok');
});

/* ------------------------------------
   Optional static (OLD local uploads)
   ⚠️ Only for backward compatibility
------------------------------------ */
if (process.env.NODE_ENV === 'development') {
  app.use(
    '/uploads',
    express.static(path.join(__dirname, 'uploads'), {
      setHeaders: (res, filePath) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        if (filePath && filePath.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Disposition', 'inline');
          res.setHeader('Content-Type', 'application/pdf');
        }
      },
    })
  );
}

/* ------------------------------------
   API routes
------------------------------------ */
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/users', '/users'], userRoutes);
app.use(['/api/projects', '/projects'], projectRoutes);
app.use(['/api/logs', '/logs'], logRoutes);

// ⚠️ uploads API – not /uploads to avoid conflict
app.use(['/api/uploads', '/uploads-api'], uploadRoutes);

app.use(['/api/notifications', '/notifications'], notificationRoutes);

/* ------------------------------------
   Root
------------------------------------ */
app.get('/', (req, res) => {
  res.json({ message: 'Daily Work Log API is running' });
});

/* ------------------------------------
   404 handler
------------------------------------ */
app.use((req, res) => {
  console.warn(`❌ Route not found: [${req.method}] ${req.originalUrl}`);
  res.status(404).json({
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

/* ------------------------------------
   Global error handler
------------------------------------ */
app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err.stack || err);
  res.status(500).json({
    message: err.message || 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

/* ------------------------------------
   Server startup (Cloud Run friendly)
------------------------------------ */
const PORT = Number(process.env.PORT) || 8080;
console.log('✅ BOOT:', __filename);
console.log('✅ ENV PORT:', process.env.PORT, '-> using', PORT);

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server is listening on port ${PORT}`);

  // 🔹 Verify GCS connection (non-blocking)
  try {
    const [exists] = await bucket.exists();
    console.log(`✅ GCS bucket connected: ${exists}`);
  } catch (err) {
    console.error('❌ GCS connection failed:', err.message);
  }
});

/* ------------------------------------
   MongoDB connection (non-blocking)
------------------------------------ */
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log('✅ Connected to MongoDB');

      initScheduledTasks();
      console.log('⏰ Scheduled tasks initialized');
    })
    .catch((err) => {
      console.error('❌ Failed to connect to MongoDB:', err.message || err);
      // ❌ No process.exit in Cloud Run
    });
}

module.exports = app;
