import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
  LiteracyProgress,
  NotificationRead,
  Scheme,
  SchemeApplication,
} from '../../database/models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { parseVoiceTransaction } from '../engines/voiceEngine.js';
import { answerFinancialQuestion } from '../engines/assistantEngine.js';
import { evaluateSchemesForUser } from '../engines/schemeEngine.js';
import { getUserNotifications } from '../engines/notificationEngine.js';

const router = express.Router();
router.use(requireAuth);

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/voice/config', (_req, res) => {
  return res.json({
    sarvamConfigured: Boolean(process.env.SARVAM_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    supportedLanguages: ['en', 'kn'],
    note:
      process.env.SARVAM_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
        ? 'External Speech/LLM provider active.'
        : 'Using browser Web Speech API + deterministic bilingual (Kannada/English) extractor. Add SARVAM_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in backend/.env for cloud speech/LLM.',
  });
});

router.post('/voice/transcribe', audioUpload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio recording file is required.' });
  }
  const language = req.body?.language === 'kn' ? 'kn-IN' : 'en-IN';

  if (process.env.SARVAM_API_KEY) {
    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }),
        'recording.webm'
      );
      form.append('language_code', language);
      form.append('model', 'saarika:v2');
      const sr = await fetch('https://api.sarvam.ai/speech-to-text', {
        method: 'POST',
        headers: { 'api-subscription-key': process.env.SARVAM_API_KEY },
        body: form,
      });
      if (sr.ok) {
        const data = await sr.json();
        return res.json({ transcript: data.transcript || '', provider: 'sarvam-ai' });
      }
    } catch {
      // fall through
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const form = new FormData();
      form.append(
        'file',
        new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }),
        'recording.webm'
      );
      form.append('model', 'whisper-1');
      form.append('language', req.body?.language === 'kn' ? 'kn' : 'en');
      const wr = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });
      if (wr.ok) {
        const data = await wr.json();
        return res.json({ transcript: data.text || '', provider: 'openai-whisper' });
      }
    } catch {
      // fall through
    }
  }

  return res.status(501).json({
    error:
      'Cloud audio transcription requires SARVAM_API_KEY or OPENAI_API_KEY in backend/.env. Please use the live Browser Microphone button or type your sentence directly.',
    requiresConfiguration: true,
  });
});

router.post('/voice/parse', async (req, res) => {
  const { transcript, language = 'en' } = req.body || {};
  const result = await parseVoiceTransaction({ transcript, language });
  return res.json(result);
});

router.post('/assistant/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'Please enter a financial question.' });
  }
  const reply = await answerFinancialQuestion(req.user.id, question);
  return res.json(reply);
});

router.get('/schemes', async (req, res) => {
  const { state = 'all', assistance_type = 'all', outcome = 'all', search = '' } = req.query;
  const schemes = await evaluateSchemesForUser(req.user.id, {
    state,
    assistance_type,
    outcome,
    search,
  });
  return res.json({ schemes });
});

router.get('/schemes/:id', async (req, res) => {
  const all = await evaluateSchemesForUser(req.user.id);
  const found = all.find((s) => s.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Scheme not found.' });
  return res.json({ scheme: found });
});

router.put('/schemes/:id/application', async (req, res) => {
  const {
    status = 'preparing',
    checklist_progress = {},
    notes = '',
    deadline_date = null,
  } = req.body || {};

  const existingScheme = await Scheme.findById(req.params.id).lean();
  if (!existingScheme) return res.status(404).json({ error: 'Scheme not found.' });

  const updated = await SchemeApplication.findOneAndUpdate(
    { user_id: req.user.id, scheme_id: req.params.id },
    {
      $set: {
        user_id: req.user.id,
        scheme_id: req.params.id,
        status,
        checklist_progress_json: JSON.stringify(checklist_progress),
        notes,
        deadline_date: deadline_date || null,
      },
      $setOnInsert: { _id: uuidv4() },
    },
    { upsert: true, new: true }
  );

  return res.json({ application: updated.toJSON() });
});

router.get('/literacy/progress', async (req, res) => {
  const rows = await LiteracyProgress.find({ user_id: req.user.id }).lean();
  return res.json({ progress: rows.map((r) => ({ ...r, id: r._id })) });
});

router.post('/literacy/progress', async (req, res) => {
  const { lesson_id, completed = true, quiz_score = 100 } = req.body || {};
  if (!lesson_id) return res.status(400).json({ error: 'lesson_id required.' });

  const existing = await LiteracyProgress.findOne({ user_id: req.user.id, lesson_id }).lean();
  const bestScore = Math.max(Number(existing?.quiz_score) || 0, Number(quiz_score) || 0);

  await LiteracyProgress.findOneAndUpdate(
    { user_id: req.user.id, lesson_id },
    {
      $set: {
        user_id: req.user.id,
        lesson_id,
        completed: completed ? 1 : 0,
        quiz_score: bestScore,
        completed_at: new Date().toISOString(),
      },
      $setOnInsert: { _id: uuidv4() },
    },
    { upsert: true }
  );

  const rows = await LiteracyProgress.find({ user_id: req.user.id }).lean();
  return res.json({ progress: rows.map((r) => ({ ...r, id: r._id })) });
});

router.get('/notifications', async (req, res) => {
  const notifications = await getUserNotifications(req.user.id);
  return res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
  });
});

router.post('/notifications/:id/read', async (req, res) => {
  const key = `${req.user.id}:${req.params.id}`;
  await NotificationRead.findByIdAndUpdate(
    key,
    {
      $set: {
        _id: key,
        user_id: req.user.id,
        notification_id: req.params.id,
        is_read: true,
      },
    },
    { upsert: true }
  );
  return res.json({ ok: true });
});

export default router;
