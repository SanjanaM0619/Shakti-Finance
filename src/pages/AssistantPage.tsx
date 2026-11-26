import React, { useState } from 'react';
import { MessageSquare, Send, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AssistantReply {
  question: string;
  intent: string;
  answer: string;
  highlights: Array<{ label: string; value: string }>;
  nextSteps: string[];
  missingData: string[];
  disclaimer: string;
}

const SUGGESTED_QUESTIONS = [
  'How much profit did I make this month?',
  'Why did my expenses increase?',
  'Which customers have not paid me?',
  'How much money can I safely use?',
  'Can I afford to purchase new equipment worth 25000?',
  'How much should I reserve for next month’s expenses?',
  'Why is my business cash decreasing?',
  'What can I do to improve my profitability?',
];

export const AssistantPage: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [history, setHistory] = useState<AssistantReply[]>([]);

  const ask = async (qText: string) => {
    if (!qText.trim()) return;
    setAsking(true);
    try {
      const reply = await apiFetch<AssistantReply>('/api/intel/assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ question: qText }),
      });
      setHistory((prev) => [reply, ...prev]);
      setQuestion('');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Explainable AI Financial Assistant</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Answers are computed directly from your verified SQLite financial ledger—never guessed or fabricated.
        </p>
      </div>

      {/* Prompt Input */}
      <section className="card-surface p-5 space-y-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about your profit, pending customer payments, equipment affordability, or reserves..."
            className="input-field flex-1"
          />
          <button type="submit" disabled={asking || !question.trim()} className="btn-primary px-5">
            <Send className="w-4 h-4" /> {asking ? 'Checking...' : 'Ask'}
          </button>
        </form>

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Suggested Questions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map((sq) => (
              <button
                key={sq}
                type="button"
                onClick={() => ask(sq)}
                className="px-3 py-1.5 rounded-lg bg-blue-50/70 hover:bg-blue-100 text-blue-800 text-xs font-medium border border-blue-100 cursor-pointer text-left"
              >
                {sq}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Conversation Feed */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 text-blue-600 mx-auto" />
            <p className="font-medium text-slate-700">
              Select a question above or type your own to inspect verified calculations.
            </p>
          </div>
        ) : (
          history.map((item, idx) => (
            <article key={idx} className="card-surface p-6 space-y-4 border-blue-100">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <h2 className="font-semibold text-slate-900 text-sm">“{item.question}”</h2>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium shrink-0">
                  Verified DB Answer
                </span>
              </div>

              <p className="text-sm text-slate-800 leading-relaxed">{item.answer}</p>

              {item.highlights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {item.highlights.map((h) => (
                    <div key={h.label} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-[11px] text-slate-500">{h.label}</p>
                      <p className="text-base font-bold text-blue-700 mt-0.5">{h.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {item.nextSteps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">Practical Next Steps</p>
                  <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                    {item.nextSteps.map((ns, i) => (
                      <li key={i}>{ns}</li>
                    ))}
                  </ul>
                </div>
              )}

              {item.missingData.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Data gaps detected: </span>
                    {item.missingData.join(' ')}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {item.disclaimer}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
