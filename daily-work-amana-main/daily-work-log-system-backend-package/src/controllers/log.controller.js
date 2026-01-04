exports.createLog = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      date,
      project,
      employees,
      startTime,
      endTime,
      workDescription,
      status,
      photos,
      documents,
    } = req.body;

    // ✅ employees יכול להגיע כמחרוזת JSON או כמערך כבר
    const parsedEmployees =
      typeof employees === 'string' ? JSON.parse(employees) : (employees || []);

    // ✅ photos/documents יכולים להגיע כמחרוזת JSON או כמערך כבר
    const parsedPhotos =
      typeof photos === 'string' ? JSON.parse(photos) : (photos || []);

    const parsedDocuments =
      typeof documents === 'string' ? JSON.parse(documents) : (documents || []);

    const existingLog = await DailyLog.findOne({
      date: new Date(date),
      teamLeader: req.userId,
      project: project.trim(),
    });

    if (existingLog) {
      await notificationController.createDuplicateWarningNotification(req.userId, date, project);
      return res.status(400).json({
        message: 'A log already exists for this date and project',
        existingLogId: existingLog._id,
      });
    }

    // (אופציונלי) תמיכה אחורה בלוקאלי אם עדיין מעלים דרך multer
    const deliveryCertificate = req.files?.deliveryCertificate?.[0]
      ? 'uploads/' + req.files.deliveryCertificate[0].path.replace(/\\/g, '/').split('uploads/')[1]
      : null;

    const workPhotos = req.files?.workPhotos?.map(file => {
      const relative = file.path.replace(/\\/g, '/').split('uploads/')[1];
      return `uploads/${relative}`;
    }) || [];

    const newLog = new DailyLog({
      date: new Date(date),
      project: project.trim(),
      employees: parsedEmployees,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      workDescription: workDescription.trim(),
      deliveryCertificate,
      workPhotos,

      // ✅ חדש – GCS
      photos: Array.isArray(parsedPhotos) ? parsedPhotos : [],
      documents: Array.isArray(parsedDocuments) ? parsedDocuments : [],

      teamLeader: req.userId,
      status: status || 'draft',
    });

    const savedLog = await newLog.save();
    return res.status(201).json(savedLog);
  } catch (error) {
    console.error('❌ Error while creating log:', error);
    return res.status(500).json({ message: error.message || 'Error creating the log' });
  }
};
