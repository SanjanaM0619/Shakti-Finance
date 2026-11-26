import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, ExternalLink, Calendar, ArrowRight } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SchemeItem } from '../types';

export const ApplicationsPage: React.FC = () => {
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch<{ schemes: SchemeItem[] }>('/api/intel/schemes');
    setSchemes(res.schemes);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const tracked = schemes.filter((s) => s.application !== null);
  const readySuggestions = schemes
    .filter((s) => s.application === null && s.evaluation.outcome !== 'Currently ineligible')
    .slice(0, 3);

  const toggleDoc = async (scheme: SchemeItem, docIdx: number) => {
    const currentProgress = (() => {
      try {
        return JSON.parse(scheme.application?.checklist_progress_json || '{}');
      } catch {
        return {};
      }
    })();
    const updated = { ...currentProgress, [docIdx]: !currentProgress[docIdx] };

    await apiFetch(`/api/intel/schemes/${scheme.id}/application`, {
      method: 'PUT',
      body: JSON.stringify({
        status: scheme.application?.status || 'preparing',
        checklist_progress: updated,
        notes: scheme.application?.notes || '',
        deadline_date: scheme.application?.deadline_date || null,
      }),
    });
    await load();
  };

  if (loading) {
    return <div className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Application Document Checklists & Tracker
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track required KYC, DPR, Udyam, and bank documents across all schemes you are preparing or applying for.
          </p>
        </div>
        <Link to="/schemes" className="btn-secondary text-xs">
          Browse All Schemes
        </Link>
      </div>

      {tracked.length === 0 ? (
        <section className="card-surface p-8 text-center space-y-3">
          <ClipboardCheck className="w-8 h-8 text-blue-600 mx-auto" />
          <h2 className="font-semibold text-slate-900">No active scheme applications yet</h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Open any scheme from the Scheme Finder to start tracking its document checklist and application status.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {tracked.map((s) => {
            let progress: Record<number, boolean> = {};
            try {
              progress = JSON.parse(s.application?.checklist_progress_json || '{}');
            } catch {
              progress = {};
            }
            const doneCount = s.required_documents.filter((_, i) => progress[i]).length;
            const pct = Math.round((doneCount / Math.max(1, s.required_documents.length)) * 100);

            return (
              <article key={s.id} className="card-surface p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                        {s.application?.status?.replace('_', ' ')}
                      </span>
                      {s.application?.deadline_date && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <Calendar className="w-3.5 h-3.5 text-blue-600" />
                          Target: {s.application.deadline_date}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-1.5">{s.name}</h2>
                    {s.application?.notes && (
                      <p className="text-xs text-slate-500 mt-0.5">{s.application.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={s.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary text-xs py-1.5 px-3"
                    >
                      Official Portal <ExternalLink className="w-3 h-3" />
                    </a>
                    <Link to={`/schemes/${s.id}`} className="btn-primary text-xs py-1.5 px-3">
                      Edit Details
                    </Link>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">Document Preparation Progress</span>
                    <span className="font-semibold text-blue-700">
                      {doneCount} / {s.required_documents.length} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {s.required_documents.map((doc, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 cursor-pointer text-xs text-slate-800"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(progress[idx])}
                        onChange={() => toggleDoc(s, idx)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600"
                      />
                      <span className={progress[idx] ? 'line-through text-slate-400' : ''}>{doc}</span>
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {readySuggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-900 text-sm">
            Start Preparing Another Matched Scheme
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {readySuggestions.map((s) => (
              <Link
                key={s.id}
                to={`/schemes/${s.id}`}
                className="card-surface p-4 hover:border-blue-300 transition-colors flex flex-col justify-between gap-3"
              >
                <div>
                  <span className="text-[11px] font-semibold text-blue-700">{s.evaluation.outcome}</span>
                  <h3 className="font-semibold text-sm text-slate-900 mt-1">{s.name}</h3>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600">
                  Open Checklist <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
