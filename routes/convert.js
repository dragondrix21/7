const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const convertController = require('../controllers/convertController');

// Настройка Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads/')),
  filename: (req, file, cb) => {
    const unique = uuidv4();
    cb(null, unique + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac',
    'audio/ogg', 'audio/mp4', 'audio/x-m4a',
    'video/mp4', 'video/avi', 'video/x-msvideo', 'video/quicktime',
    'video/x-matroska', 'video/webm', 'video/x-ms-wmv',
    'video/x-flv', 'application/octet-stream'
  ];
  // Пропускаем по mimetype ИЛИ по расширению
  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const allowedExt = ['mp3','wav','flac','aac','ogg','m4a','mp4','avi','mov','mkv','webm','wmv','flv'];
  if (allowed.includes(file.mimetype) || allowedExt.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый формат файла'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 МБ
});

// POST /api/convert
router.post('/convert', upload.single('file'), convertController.convert);

// GET /api/download/:filename
router.get('/download/:filename', convertController.download);

// GET /api/formats
router.get('/formats', (req, res) => {
  res.json({
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'],
    video: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv']
  });
});

module.exports = router;
