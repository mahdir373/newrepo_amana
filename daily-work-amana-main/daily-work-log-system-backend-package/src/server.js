require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initScheduledTasks } = require('./utils/scheduler');

// 🔥 מוסיפים את ה-controller של auth
const authController = require('./controllers/auth.controller');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const projectRoutes = require('./routes/project.routes');
// const employeeRoutes = require('./routes/employee.routes');
const logRoutes = require('./routes/log.routes');
const uploadRoutes = require('./routes/upload.routes');
const notificationRoutes = require('./routes/notification.routes');

// Create Express app
const app = express();

// Middleware
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

// Static files (uploads)
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

// ------------------ API ROUTES ------------------

// router רגיל
app.use('/api/auth', authRoutes);

// ✅ ראוט ישיר ללוגין – מבטיח ש־/api/auth/login תמיד עובד
app.post('/api/auth/login', (req, res, next) => {
  console.log('🔥 /api/auth/login reached directly in server.js');
  authController.login(req, res, next);
});

app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/employees', employeeRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/notifications', notificationRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Daily Work Log System API' });
});

// 404 – אם אין ראוט
app.use((req, res, next) => {
  console.warn(`❌ Route not found: [${req.method}] ${req.originalUrl}`);
  res.status(404).json({
    message: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
});

// Error handler 500
app.use((err, req, res, next) => {
  console.error('🔥 Server error:', err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong on the server',
    error: process.env.NODE_ENV === 'development' ? err : {},
  });
});

// ------------------ DB & SERVER ------------------

const PORT = process.env.PORT || 5001;

// ⛽️ לוקחים את ה-URI רק מה־ENV, לא נופלים ל־localhost בטעות
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not defined in environment variables');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

    initScheduledTasks();
    console.log('⏰ Scheduled tasks initialized');
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB', err);
    process.exit(1);
  });

module.exports = app;