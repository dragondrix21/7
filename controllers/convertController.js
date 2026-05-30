const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Отправить прогресс клиенту через WebSocket
function sendProgress(jobId, data) {
  const ws = global.wsClients && global.wsClients.get(jobId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

exports.convert = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }

  const { format, bitrate, sampleRate, resolution } = req.body;
  const jobId = req.body.jobId || uuidv4();

  if (!format) {
    return res.status(400).json({ error: 'Формат не указан' });
  }

  const inputPath = req.file.path;
  const outputFilename = uuidv4() + '.' + format;
  const outputPath = path.join(__dirname, '../converted/', outputFilename);

  // Сразу отвечаем клиенту jobId
  res.json({ jobId, outputFilename, status: 'processing' });

  // Запускаем конвертацию асинхронно
  try {
    let cmd = ffmpeg(inputPath);

    // Аудио параметры
    if (bitrate) cmd = cmd.audioBitrate(bitrate);
    if (sampleRate) cmd = cmd.audioFrequency(parseInt(sampleRate));

    // Видео параметры
    if (resolution && resolution !== 'original') {
      cmd = cmd.size(resolution);
    }

    // Специальные настройки форматов
    if (format === 'mp3') {
      cmd = cmd.audioCodec('libmp3lame');
    } else if (format === 'aac') {
      cmd = cmd.audioCodec('aac');
    } else if (format === 'flac') {
      cmd = cmd.audioCodec('flac');
    } else if (format === 'ogg') {
      cmd = cmd.audioCodec('libvorbis');
    } else if (format === 'wav') {
      cmd = cmd.audioCodec('pcm_s16le');
    }

    cmd
      .toFormat(format)
      .on('start', () => {
        sendProgress(jobId, { type: 'start', message: 'Начало конвертации...' });
      })
      .on('progress', (progress) => {
        const pct = Math.round(progress.percent || 0);
        sendProgress(jobId, {
          type: 'progress',
          percent: pct,
          timemark: progress.timemark
        });
      })
      .on('end', () => {
        sendProgress(jobId, {
          type: 'done',
          percent: 100,
          downloadUrl: `/api/download/${outputFilename}`,
          filename: outputFilename
        });
        // Удалить исходный файл
        fs.unlink(inputPath, () => {});
      })
      .on('error', (err) => {
        sendProgress(jobId, {
          type: 'error',
          message: 'Ошибка конвертации: ' + err.message
        });
        fs.unlink(inputPath, () => {});
      })
      .save(outputPath);

  } catch (err) {
    sendProgress(jobId, { type: 'error', message: err.message });
  }
};

exports.download = (req, res) => {
  const filename = req.params.filename;
  // Защита от path traversal
  const safe = path.basename(filename);
  const filePath = path.join(__dirname, '../converted/', safe);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Файл не найден или удалён' });
  }

  res.download(filePath);
};
