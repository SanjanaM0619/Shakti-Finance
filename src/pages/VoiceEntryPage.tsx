import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Sparkles, CheckCircle2, AlertCircle, Send, Upload } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ParsedTxDraft {
  entry_kind: 'sale' | 'expense' | 'household_withdrawal' | 'personal_contribution';
  tx_date: string;
  item_name: string;
  category: string;
  quantity: number;
  unit_price: number;
  amount: number;
  payment_method: 'cash' | 'upi' | 'bank_transfer' | 'credit';
  payment_method_inferred?: boolean;
  confidence: string;
}

const SAMPLE_PROMPTS = [
  {
    lang: 'en',
    label: 'English multi-entry',
    text: 'Today I sold 20 packets of snacks for 2,000 rupees and spent 600 rupees buying ingredients.',
  },
  {
    lang: 'en',
    label: 'UPI + Household draw',
    text: 'Sold 15 pickle jars for 2250 rupees via UPI and took 1000 rupees cash for household groceries.',
  },
  {
    lang: 'kn',
    label: 'ಕನ್ನಡ (Kannada)',
    text: 'ಇಂದು 1800 ರೂಪಾಯಿ ಮಾರಾಟ ಮತ್ತು 550 ರೂಪಾಯಿ ಸಾಮಗ್ರಿ ಖರ್ಚು',
  },
];

export const VoiceEntryPage: React.FC = () => {
  const { language, isOnline, queueOfflineTx } = useAuth();
  const [speechLang, setSpeechLang] = useState<'en-IN' | 'kn-IN'>(language === 'kn' ? 'kn-IN' : 'en-IN');
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [configNote, setConfigNote] = useState<string>('');
  const [cloudConfigured, setCloudConfigured] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [parsing, setParsing] = useState(false);
  const [drafts, setDrafts] = useState<ParsedTxDraft[]>([]);
  const [clarifications, setClarifications] = useState<string[]>([]);
  const [parserMode, setParserMode] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(Boolean(SR));

    apiFetch<{ note: string; sarvamConfigured: boolean; openaiConfigured: boolean }>('/api/intel/voice/config')
      .then((res) => {
        setConfigNote(res.note);
        setCloudConfigured(Boolean(res.sarvamConfigured || res.openaiConfigured));
      })
      .catch(() => setConfigNote('Offline mode: browser text entry available.'));
  }, []);

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event: any) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript + ' ';
      }
      setTranscript(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const handleAudioUpload = async (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.append('audio', file);
    fd.append('language', speechLang.startsWith('kn') ? 'kn' : 'en');
    try {
      const res = await apiFetch<{ transcript: string }>('/api/intel/voice/transcribe', {
        method: 'POST',
        body: fd,
      });
      setTranscript(res.transcript);
    } catch (err: any) {
      setUploadError(err.message);
    }
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) return;
    setParsing(true);
    setSavedMsg(null);
    try {
      const res = await apiFetch<{
        transactions: ParsedTxDraft[];
        clarificationQuestions: string[];
        parserMode: string;
      }>('/api/intel/voice/parse', {
        method: 'POST',
        body: JSON.stringify({
          transcript,
          language: speechLang.startsWith('kn') ? 'kn' : 'en',
        }),
      });
      setDrafts(res.transactions);
      setClarifications(res.clarificationQuestions);
      setParserMode(res.parserMode);
    } finally {
      setParsing(false);
    }
  };

  const updateDraft = (idx: number, patch: Partial<ParsedTxDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const handleConfirmAndSaveAll = async () => {
    if (drafts.length === 0) return;
    setSaving(true);
    try {
      let savedCount = 0;
      for (const d of drafts) {
        if (!d.amount || d.amount <= 0) continue;
        const payload = {
          tx_date: d.tx_date,
          entry_kind: d.entry_kind,
          item_name: d.item_name,
          category: d.category,
          quantity: d.quantity || 1,
          unit_price: d.unit_price || d.amount,
          amount: d.amount,
          payment_method: d.payment_method,
          source: 'voice',
        };
        if (!isOnline) {
          queueOfflineTx(payload);
        } else {
          await apiFetch('/api/finance/transactions', {
            method: 'POST',
            body: JSON.stringify(payload),
          });
        }
        savedCount++;
      }
      setSavedMsg(
        isOnline
          ? `Confirmed & saved ${savedCount} validated transaction(s) to your ledger.`
          : `Queued ${savedCount} transaction(s) offline for sync.`
      );
      setDrafts([]);
      setClarifications([]);
      setTranscript('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Voice-First Regional Language Transaction Entry
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Speak naturally in Kannada or English. Nothing is saved to your ledger until you review and confirm.
          </p>
        </div>

        <select
          value={speechLang}
          onChange={(e) => setSpeechLang(e.target.value as 'en-IN' | 'kn-IN')}
          className="input-field w-auto text-xs font-semibold"
        >
          <option value="en-IN">English (India)</option>
          <option value="kn-IN">ಕನ್ನಡ (Kannada - India)</option>
        </select>
      </div>

      {configNote && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
          {configNote}
        </div>
      )}

      {savedMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {savedMsg}
        </div>
      )}

      {/* Voice Input Card */}
      <section className="card-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              disabled={!speechSupported}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer ${
                listening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {listening
                ? 'Listening... Tap to Stop'
                : speechSupported
                  ? `Speak Now (${speechLang === 'kn-IN' ? 'ಕನ್ನಡ' : 'English'})`
                  : 'Browser Mic Unavailable — Type Below'}
            </button>

            <label
              className="btn-secondary text-xs py-2.5 cursor-pointer"
              title={cloudConfigured ? 'Transcribe audio via Sarvam AI / Whisper' : 'Requires SARVAM_API_KEY or OPENAI_API_KEY in .env'}
            >
              <Upload className="w-4 h-4" /> Upload Voice Clip
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleAudioUpload(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_PROMPTS.map((sp) => (
              <button
                key={sp.label}
                type="button"
                onClick={() => setTranscript(sp.text)}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-[11px] font-medium text-slate-700 cursor-pointer"
              >
                Try: {sp.label}
              </button>
            ))}
          </div>
        </div>

        {uploadError && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {uploadError}
          </div>
        )}

        <div>
          <label className="label-text">Spoken / Natural-Language Description</label>
          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder='Example: "Today I sold 20 packets of snacks for 2,000 rupees and spent 600 rupees buying ingredients."'
            className="input-field"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={parsing || !transcript.trim()}
            className="btn-primary"
          >
            <Sparkles className="w-4 h-4" />
            {parsing ? 'Extracting...' : 'Extract & Preview Transactions'}
          </button>
        </div>
      </section>

      {/* Clarification Questions */}
      {clarifications.length > 0 && (
        <section className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <h2 className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4" /> Clarification Needed Before Saving
          </h2>
          <ul className="list-disc pl-5 text-xs text-amber-900 space-y-1">
            {clarifications.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Confirmation Preview Table */}
      {drafts.length > 0 && (
        <section className="card-surface p-6 space-y-4 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">
                Review & Confirm Extracted Entries ({drafts.length})
              </h2>
              <p className="text-xs text-slate-500">
                Parser: {parserMode}. Edit any field below before saving to your validated ledger.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmAndSaveAll}
              disabled={saving}
              className="btn-primary"
            >
              <Send className="w-4 h-4" />
              {saving ? 'Saving...' : 'Confirm & Save to Ledger'}
            </button>
          </div>

          <div className="space-y-3">
            {drafts.map((d, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-slate-50 border border-slate-200 grid sm:grid-cols-6 gap-3 items-end"
              >
                <div>
                  <label className="label-text">Type</label>
                  <select
                    value={d.entry_kind}
                    onChange={(e) => updateDraft(idx, { entry_kind: e.target.value as any })}
                    className="input-field text-xs"
                  >
                    <option value="sale">Sale</option>
                    <option value="expense">Business Expense</option>
                    <option value="household_withdrawal">Household Withdrawal</option>
                    <option value="personal_contribution">Personal Contribution</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label-text">Description</label>
                  <input
                    type="text"
                    value={d.item_name}
                    onChange={(e) => updateDraft(idx, { item_name: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="label-text">Category</label>
                  <input
                    type="text"
                    value={d.category}
                    onChange={(e) => updateDraft(idx, { category: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="label-text">Amount (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={d.amount}
                    onChange={(e) => updateDraft(idx, { amount: Number(e.target.value) })}
                    className="input-field text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="label-text">Method</label>
                  <select
                    value={d.payment_method}
                    onChange={(e) => updateDraft(idx, { payment_method: e.target.value as any })}
                    className="input-field text-xs"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 flex justify-between pt-2 border-t border-slate-100">
            <span>Total amount in preview: {formatInr(drafts.reduce((s, d) => s + (d.amount || 0), 0))}</span>
            <span>Deterministic validation runs on save</span>
          </div>
        </section>
      )}
    </div>
  );
};
