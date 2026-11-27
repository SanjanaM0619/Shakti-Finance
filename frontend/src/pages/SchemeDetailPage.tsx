import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, CheckCircle2, HelpCircle, XCircle, ClipboardCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SchemeItem } from '../types';

export const SchemeDetailPage: React.FC = () => {
  const { id } = useParams();
  const [scheme, setScheme] = useState<SchemeItem | null>(null);
  const [status, setStatus] = useState('preparing');
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState('');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    apiFetch<{ scheme: SchemeItem }>(`/api/intel/schemes/${id}`).then((res) => {
      setScheme(res.scheme);
      if (res.scheme.application) {
        setStatus(res.scheme.application.status || 'preparing');
        setNotes(res.scheme.application.notes || '');
        setDeadlineDate(res.scheme.application.deadline_date || '');
        try {
          setChecklist(JSON.parse(res.scheme.application.checklist_progress_json || '{}'));
        } catch {
          setChecklist({});
        }
      }
    });
  }, [id]);

  if (!scheme) {
    return <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  const saveApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch(`/api/intel/schemes/${scheme.id}/application`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        checklist_progress: checklist,
        notes,
        deadline_date: deadlineDate || null,
      }),
    });
    setSavedMsg('Checklist & application tracking status saved.');
  };

  const completedDocs = scheme.required_documents.filter((_, idx) => checklist[idx]).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/schemes" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700">
          <ArrowLeft className="w-4 h-4" /> Back to Scheme Finder
        </Link>
        <a
          href={scheme.official_url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary text-xs"
        >
          Visit Official Portal <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Overview */}
      <section className="card-surface p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {scheme.assistance_type.replace('_', ' ')} • {scheme.state}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">{scheme.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{scheme.department}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Last verified: {scheme.last_verified_date}</p>
            <p>Source: {scheme.source_reference}</p>
          </div>
        </div>

        <p className="text-sm text-slate-700">{scheme.summary}</p>
        <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100 text-sm text-slate-800">
          <strong className="text-blue-900">Verified Benefit: </strong>
          {scheme.financial_benefit}
        </div>
      </section>

      {/* Rule-by-rule Eligibility Explanation */}
      <section className="card-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Personalized Eligibility Assessment</h2>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            {scheme.evaluation.outcome}
          </span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-1.5">
            <p className="font-semibold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Matched Criteria
            </p>
            {scheme.evaluation.matchedReasons.length === 0 ? (
              <p className="text-emerald-700">No criteria matched yet.</p>
            ) : (
              scheme.evaluation.matchedReasons.map((r, i) => <p key={i}>• {r}</p>)
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-1.5">
            <p className="font-semibold text-amber-900 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> Additional Info Needed
            </p>
            {scheme.evaluation.missingInfoReasons.length === 0 ? (
              <p className="text-amber-800">No missing fields.</p>
            ) : (
              scheme.evaluation.missingInfoReasons.map((r, i) => <p key={i}>• {r}</p>)
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-rose-50/70 border border-rose-200 space-y-1.5">
            <p className="font-semibold text-rose-900 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Ineligibility Factors
            </p>
            {scheme.evaluation.ineligibleReasons.length === 0 ? (
              <p className="text-rose-700">None detected.</p>
            ) : (
              scheme.evaluation.ineligibleReasons.map((r, i) => <p key={i}>• {r}</p>)
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500">{scheme.evaluation.disclaimer}</p>
      </section>

      {/* Document Checklist & Application Tracker */}
      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 card-surface p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-blue-600" /> Application Document Checklist
            </h2>
            <span className="text-xs font-semibold text-blue-700">
              {completedDocs} / {scheme.required_documents.length} ready
            </span>
          </div>

          {savedMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {savedMsg}
            </div>
          )}

          <form onSubmit={saveApplication} className="space-y-4">
            <ul className="space-y-2">
              {scheme.required_documents.map((doc, idx) => (
                <li key={idx}>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 cursor-pointer text-xs text-slate-800">
                    <input
                      type="checkbox"
                      checked={Boolean(checklist[idx])}
                      onChange={(e) => setChecklist({ ...checklist, [idx]: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300 text-blue-600"
                    />
                    <span className={checklist[idx] ? 'line-through text-slate-400' : ''}>{doc}</span>
                  </label>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="label-text">My Application Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="input-field text-xs"
                >
                  <option value="bookmarked">Bookmarked</option>
                  <option value="preparing">Preparing Documents</option>
                  <option value="submitted">Submitted on Portal/Bank</option>
                  <option value="under_review">Under Review</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Not Approved</option>
                </select>
              </div>
              <div>
                <label className="label-text">Target Deadline Reminder</label>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="input-field text-xs"
                />
              </div>
            </div>

            <div>
              <label className="label-text">Application Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Bank branch contact or reference number"
                className="input-field text-xs"
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              Save Checklist & Application Status
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 card-surface p-6 space-y-4 h-fit">
          <h2 className="font-semibold text-slate-900">Step-by-Step Application Guide</h2>
          <ol className="space-y-3">
            {scheme.application_steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-xs text-slate-700">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="pt-1 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};
