const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

const convertRouter = require('./routes/convert');

const app = express();
const server = http.createServer(app);

// WebSocket сервер для прогресса
const wss = new WebSocket.Server({ server });

// Глобальное хранилище WebSocket-клиентов по jobId
global.wsClients = new Map();

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const jobId = url.searchParams.get('jobId');
  if (jobId) {
    global.wsClients.set(jobId, ws);
    ws.on('close', () => global.wsClients.delete(jobId));
  }
});

// Создать папки если нет
['uploads', 'converted'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p);
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Роут конвертации
app.use('/api', convertRouter);

// Отдать index.html для всех остальных маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Автоудаление файлов старше 48 часов
setInterval(() => {
  const dirs = ['uploads', 'converted'];
  const maxAge = 48 * 60 * 60 * 1000;
  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    fs.readdir(dirPath, (err, files) => {
      if (err) return;
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        fs.stat(filePath, (err, stat) => {
          if (err) return;
          if (Date.now() - stat.mtimeMs > maxAge) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  });
}, 60 * 60 * 1000); // каждый час

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅ MediaConvert запущен: http://localhost:${PORT}\n`);
});
