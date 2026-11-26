import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
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

// Voice NLP parsing + configuration status check
router.get('/voice/config', (_req, res) => {
  return res.json({
    sarvamConfigured: Boolean(process.env.SARVAM_API_KEY),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    supportedLanguages: ['en', 'kn'],
    note:
      process.env.SARVAM_API_KEY || process.env.OPENAI_API_KEY
        ? 'External Speech/LLM provider active.'
        : 'Using browser Web Speech API + deterministic bilingual (Kannada/English) extractor. Add SARVAM_API_KEY or OPENAI_API_KEY in .env for cloud audio transcription.',
  });
});

// Optional cloud Speech-to-Text endpoint (Sarvam AI Saaras / OpenAI Whisper)
router.post('/voice/transcribe', audioUpload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio recording file is required.' });
  }
  const language = req.body?.language === 'kn' ? 'kn-IN' : 'en-IN';

  if (process.env.SARVAM_API_KEY) {
    try {
      const form = new FormData();
      form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }), 'recording.webm');
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
      form.append('file', new Blob([req.file.buffer], { type: req.file.mimetype || 'audio/webm' }), 'recording.webm');
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
      'Cloud audio transcription requires SARVAM_API_KEY or OPENAI_API_KEY in .env. Please use the live Browser Microphone button or type your sentence directly.',
    requiresConfiguration: true,
  });
});

router.post('/voice/parse', async (req, res) => {
  const { transcript, language = 'en' } = req.body || {};
  const result = await parseVoiceTransaction({ transcript, language });
  return res.json(result);
});

// Explainable AI Financial Assistant
router.post('/assistant/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: 'Please enter a financial question.' });
  }
  const reply = await answerFinancialQuestion(req.user.id, question);
  return res.json(reply);
});

// Government Schemes Discovery & Eligibility Engine
router.get('/schemes', (req, res) => {
  const { state = 'all', assistance_type = 'all', outcome = 'all', search = '' } = req.query;
  const schemes = evaluateSchemesForUser(req.user.id, {
    state,
    assistance_type,
    outcome,
    search,
  });
  return res.json({ schemes });
});

router.get('/schemes/:id', (req, res) => {
  const all = evaluateSchemesForUser(req.user.id);
  const found = all.find((s) => s.id === req.params.id);
  if (!found) return res.status(404).json({ error: 'Scheme not found.' });
  return res.json({ scheme: found });
});

router.put('/schemes/:id/application', (req, res) => {
  const { status = 'preparing', checklist_progress = {}, notes = '', deadline_date = null } = req.body || {};
  const existingScheme = db.prepare(`SELECT id FROM schemes WHERE id = ?`).get(req.params.id);
  if (!existingScheme) return res.status(404).json({ error: 'Scheme not found.' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO scheme_applications (id, user_id, scheme_id, status, checklist_progress_json, notes, deadline_date, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, scheme_id) DO UPDATE SET
      status = excluded.status,
      checklist_progress_json = excluded.checklist_progress_json,
      notes = excluded.notes,
      deadline_date = excluded.deadline_date,
      updated_at = datetime('now')
  `).run(id, req.user.id, req.params.id, status, JSON.stringify(checklist_progress), notes, deadline_date || null);

  const row = db
    .prepare(`SELECT * FROM scheme_applications WHERE user_id = ? AND scheme_id = ?`)
    .get(req.user.id, req.params.id);
  return res.json({ application: row });
});

// Financial Literacy Progress
router.get('/literacy/progress', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM literacy_progress WHERE user_id = ?`)
    .all(req.user.id);
  return res.json({ progress: rows });
});

router.post('/literacy/progress', (req, res) => {
  const { lesson_id, completed = true, quiz_score = 100 } = req.body || {};
  if (!lesson_id) return res.status(400).json({ error: 'lesson_id required.' });

  db.prepare(`
    INSERT INTO literacy_progress (id, user_id, lesson_id, completed, quiz_score, completed_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET
      completed = excluded.completed,
      quiz_score = MAX(literacy_progress.quiz_score, excluded.quiz_score),
      completed_at = datetime('now')
  `).run(uuidv4(), req.user.id, lesson_id, completed ? 1 : 0, Number(quiz_score) || 0);

  return res.json({
    progress: db.prepare(`SELECT * FROM literacy_progress WHERE user_id = ?`).all(req.user.id),
  });
});

// Live Notifications
router.get('/notifications', (req, res) => {
  const notifications = getUserNotifications(req.user.id);
  return res.json({
    notifications,
    unreadCount: notifications.filter((n) => !n.is_read).length,
  });
});

router.post('/notifications/:id/read', (req, res) => {
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, is_read)
    VALUES (?, ?, 'ack', '', '', 1)
    ON CONFLICT(id) DO UPDATE SET is_read = 1
  `).run(req.params.id, req.user.id);

  return res.json({ ok: true });
});

export default router;
