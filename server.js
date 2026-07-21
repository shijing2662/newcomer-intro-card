require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

function getLanUrls(port) {
  const urls = [];
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const net of list) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

const app = express();
const PORT = process.env.PORT || 3456;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'admin123';
const NOTIFY_WEBHOOK = process.env.NOTIFY_WEBHOOK_URL;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const SUBMISSIONS_FILE = path.join(DATA_DIR, 'submissions.json');

[DATA_DIR, UPLOADS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

if (!fs.existsSync(SUBMISSIONS_FILE)) {
  fs.writeFileSync(SUBMISSIONS_FILE, '[]', 'utf-8');
}

function readSubmissions() {
  try {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeSubmissions(list) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: '未授权' });
  next();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 JPG/PNG/WebP 图片'));
  },
});

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));
app.use('/uploads', express.static(UPLOADS_DIR));

async function sendNotification(submission) {
  if (!NOTIFY_WEBHOOK) return;
  const text = [
    '【新人介绍卡】有新提交',
    `姓名：${submission.name}`,
    `部门和岗位：${submission.position}`,
    `提交时间：${submission.submittedAt}`,
    `下载：${submission.adminUrl}`,
  ].join('\n');
  try {
    await fetch(NOTIFY_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
    });
  } catch (err) {
    console.error('通知发送失败:', err.message);
  }
}

app.post('/api/submit', upload.single('avatar'), async (req, res) => {
  try {
    const { name, position, introduction, hometown, contact, cardImage } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: '请填写姓名' });
    if (!cardImage) return res.status(400).json({ error: '请生成卡片图片后再提交' });

    const id = uuidv4();
    const cardFilename = `${id}.png`;
    const cardPath = path.join(UPLOADS_DIR, cardFilename);
    const base64Data = cardImage.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(cardPath, Buffer.from(base64Data, 'base64'));

    const host = req.get('host');
    const protocol = req.protocol;
    const adminUrl = `${protocol}://${host}/admin.html?token=${ADMIN_TOKEN}`;

    const submission = {
      id,
      name: name.trim(),
      position: (position || '').trim(),
      introduction: (introduction || '').trim(),
      hometown: (hometown || '').trim(),
      contact: (contact || '').trim(),
      avatarPath: req.file ? `/uploads/${req.file.filename}` : null,
      cardPath: `/uploads/${cardFilename}`,
      submittedAt: new Date().toISOString(),
      adminUrl,
    };

    const list = readSubmissions();
    list.unshift(submission);
    writeSubmissions(list);
    await sendNotification(submission);
    res.json({ success: true, message: '提交成功！HR 将尽快处理。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '提交失败' });
  }
});

app.get('/api/info', (req, res) => {
  const host = req.get('host');
  const lanUrls = getLanUrls(PORT);
  res.json({
    local: `http://localhost:${PORT}`,
    lan: lanUrls,
    share: lanUrls[0] || `http://localhost:${PORT}`,
    admin: `http://${host}/admin.html?token=${ADMIN_TOKEN}`,
  });
});

app.get('/api/submissions', requireAdmin, (_req, res) => {
  res.json(readSubmissions());
});

app.delete('/api/submissions/:id', requireAdmin, (req, res) => {
  const list = readSubmissions();
  const idx = list.findIndex((s) => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '未找到' });
  const [removed] = list.splice(idx, 1);
  writeSubmissions(list);
  const cardFile = path.join(UPLOADS_DIR, path.basename(removed.cardPath));
  if (fs.existsSync(cardFile)) fs.unlinkSync(cardFile);
  res.json({ success: true });
});

app.get('*', (req, res, next) => {
  // 静态资源不存在时返回 404，避免把 index.html 当成图片等资源返回
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  const lanUrls = getLanUrls(PORT);
  console.log(`\n新人介绍卡（本机）: http://localhost:${PORT}`);
  if (lanUrls.length) {
    console.log('发给同事的链接（须同一内网/WiFi，且本机服务保持运行）：');
    lanUrls.forEach((u) => console.log(`  → ${u}`));
  } else {
    console.log('未检测到局域网 IP，同事可能无法访问');
  }
  console.log(`管理后台: http://localhost:${PORT}/admin.html?token=${ADMIN_TOKEN}\n`);
});
