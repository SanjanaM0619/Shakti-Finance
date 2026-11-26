import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, ExternalLink, Search, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { SchemeItem } from '../types';

const ASSISTANCE_LABELS: Record<string, string> = {
  loan: 'Loan',
  subsidy: 'Credit-Linked Subsidy',
  grant: 'Grant',
  interest_subvention: 'Interest Subvention',
  credit_guarantee: 'Credit Guarantee',
  training: 'Training & Capacity Building',
};

export const SchemesPage: React.FC = () => {
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [stateFilter, setStateFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadSchemes = useCallback(async () => {
    const params = new URLSearchParams({
      state: stateFilter,
      assistance_type: typeFilter,
      outcome: outcomeFilter,
      search,
    });
    const res = await apiFetch<{ schemes: SchemeItem[] }>(`/api/intel/schemes?${params}`);
    setSchemes(res.schemes);
  }, [stateFilter, typeFilter, outcomeFilter, search]);

  useEffect(() => {
    loadSchemes().catch(() => {});
  }, [loadSchemes]);

  const outcomeBadge = (outcome: string) => {
    if (outcome === 'Potentially eligible') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Potentially eligible
        </span>
      );
    }
    if (outcome === 'Additional information required') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <HelpCircle className="w-3.5 h-3.5" /> Additional information required
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <XCircle className="w-3.5 h-3.5" /> Currently ineligible
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Verified Government Scheme & Opportunity Finder
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Central and Karnataka schemes matched transparently against your business profile. Clearly distinguishes loans, subsidies, subventions, and training.
          </p>
        </div>
        <Link to="/onboarding" className="btn-secondary text-xs shrink-0">
          Update Business Profile
        </Link>
      </div>

      {/* Filters */}
      <section className="card-surface p-4 grid sm:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MUDRA, PMFME, Udyogini..."
            className="input-field pl-9 text-xs"
          />
        </div>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="input-field text-xs"
        >
          <option value="all">All Applicable States</option>
          <option value="Karnataka">Karnataka + Central</option>
          <option value="All India">Central (All India)</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-field text-xs"
        >
          <option value="all">All Assistance Types</option>
          {Object.entries(ASSISTANCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="input-field text-xs"
        >
          <option value="all">All Match Outcomes</option>
          <option value="Potentially eligible">Potentially eligible</option>
          <option value="Additional information required">Additional info required</option>
          <option value="Currently ineligible">Currently ineligible</option>
        </select>
      </section>

      {/* Scheme Cards */}
      <div className="grid lg:grid-cols-2 gap-5">
        {schemes.map((s) => (
          <article key={s.id} className="card-surface p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {ASSISTANCE_LABELS[s.assistance_type] || s.assistance_type}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">{s.state}</span>
                  {s.status === 'verification_required' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      Verify Active Window
                    </span>
                  )}
                </div>
                {outcomeBadge(s.evaluation.outcome)}
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600 shrink-0" />
                  {s.name}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">{s.department}</p>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">{s.summary}</p>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700">
                <strong className="text-slate-900">Official Benefit: </strong>
                {s.financial_benefit}
              </div>

              {/* Outcome Explanation */}
              <div className="text-xs space-y-1">
                {s.evaluation.ineligibleReasons.map((r, i) => (
                  <p key={i} className="text-rose-700">• {r}</p>
                ))}
                {s.evaluation.missingInfoReasons.map((r, i) => (
                  <p key={i} className="text-amber-800">• {r}</p>
                ))}
                {s.evaluation.ineligibleReasons.length === 0 &&
                  s.evaluation.matchedReasons.slice(0, 2).map((r, i) => (
                    <p key={i} className="text-emerald-700">✓ {r}</p>
                  ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                Verified: {s.last_verified_date}
                {s.application ? ` • Status: ${s.application.status}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={s.official_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs py-1.5 px-3"
                >
                  Portal <ExternalLink className="w-3 h-3" />
                </a>
                <Link to={`/schemes/${s.id}`} className="btn-primary text-xs py-1.5 px-3">
                  Eligibility & Checklist
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};
