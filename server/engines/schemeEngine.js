import { db } from '../db.js';

/**
 * Deterministic Government Scheme Eligibility Matching Engine.
 * Evaluates each verified scheme against the user's business profile and optional
 * consented eligibility details, returning one of three strict classifications:
 *   1. 'Potentially eligible'
 *   2. 'Additional information required'
 *   3. 'Currently ineligible'
 * Never claims guaranteed/official approval.
 */
export function evaluateSchemesForUser(userId, filters = {}) {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) || {};
  const profile = db.prepare(`SELECT * FROM business_profiles WHERE user_id = ?`).get(userId) || {};
  const extra = db.prepare(`SELECT * FROM scheme_eligibility_extra WHERE user_id = ?`).get(userId) || null;
  const applications = db
    .prepare(`SELECT * FROM scheme_applications WHERE user_id = ?`)
    .all(userId);
  const appByScheme = new Map(applications.map((a) => [a.scheme_id, a]));

  let schemes = db.prepare(`SELECT * FROM schemes ORDER BY state ASC, name ASC`).all();

  if (filters.state && filters.state !== 'all') {
    schemes = schemes.filter(
      (s) => s.state.toLowerCase() === filters.state.toLowerCase() || s.state === 'All India'
    );
  }
  if (filters.assistance_type && filters.assistance_type !== 'all') {
    schemes = schemes.filter((s) => s.assistance_type === filters.assistance_type);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    schemes = schemes.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }

  return schemes.map((row) => {
    const rules = JSON.parse(row.eligibility_rules_json);
    const requiredDocuments = JSON.parse(row.required_documents_json);
    const applicationSteps = JSON.parse(row.application_steps_json);
    const evaluation = evaluateSingleScheme(row, rules, user, profile, extra);

    if (filters.outcome && filters.outcome !== 'all' && evaluation.outcome !== filters.outcome) {
      return null;
    }

    return {
      id: row.id,
      name: row.name,
      department: row.department,
      state: row.state,
      category: row.category,
      assistance_type: row.assistance_type,
      summary: row.summary,
      financial_benefit: row.financial_benefit,
      eligibility_rules: rules,
      required_documents: requiredDocuments,
      application_steps: applicationSteps,
      official_url: row.official_url,
      opening_date: row.opening_date,
      closing_date: row.closing_date,
      status: row.status,
      last_verified_date: row.last_verified_date,
      source_reference: row.source_reference,
      evaluation,
      application: appByScheme.get(row.id) || null,
    };
  }).filter(Boolean);
}

export function evaluateSingleScheme(scheme, rules, user, profile, extra) {
  const matchedReasons = [];
  const ineligibleReasons = [];
  const missingInfoReasons = [];

  const userState = (profile.state || 'Karnataka').trim();
  const userStage = profile.enterprise_stage || '';
  const userArea = profile.area_type || '';
  const userOwnership = profile.ownership_type || '';
  const userCategory = profile.category || '';
  const fundingReq = Number(profile.funding_requirement) || 0;
  const hasUdyam = profile.udyam_status === 'registered' || profile.registration_status === 'udyam_registered';

  // 1. State check
  if (rules.states && !rules.states.includes('All India')) {
    if (!userState) {
      missingInfoReasons.push('Business state is not specified in your profile.');
    } else if (!rules.states.some((st) => st.toLowerCase() === userState.toLowerCase())) {
      ineligibleReasons.push(`Scheme applies to ${rules.states.join(', ')}, while your profile lists ${userState}.`);
    } else {
      matchedReasons.push(`Located in eligible state (${userState}).`);
    }
  } else {
    matchedReasons.push('Available across India (Central scheme).');
  }

  // 2. Enterprise stage check
  if (rules.stages && rules.stages.length > 0) {
    if (!userStage) {
      missingInfoReasons.push('Business stage (new vs existing) is missing.');
    } else if (!rules.stages.includes(userStage)) {
      ineligibleReasons.push(
        `Requires a ${rules.stages.join(' or ')} enterprise; your business is marked as ${userStage}.`
      );
    } else {
      matchedReasons.push(`Matches enterprise stage (${userStage}).`);
    }
  }

  // 3. Rural vs Urban check
  if (rules.area_types && rules.area_types.length > 0) {
    if (!userArea) {
      missingInfoReasons.push('Rural/Urban classification is missing.');
    } else if (!rules.area_types.includes(userArea)) {
      ineligibleReasons.push(`Restricted to ${rules.area_types.join('/')} areas; profile is ${userArea}.`);
    } else {
      matchedReasons.push(`Matches location classification (${userArea}).`);
    }
  }

  // 4. Ownership / SHG check
  if (rules.ownership_types && rules.ownership_types.length > 0) {
    if (!userOwnership) {
      missingInfoReasons.push('Ownership structure (individual/partnership/SHG) is missing.');
    } else if (!rules.ownership_types.includes(userOwnership)) {
      if (rules.requires_shg_membership && extra?.shg_member) {
        matchedReasons.push('You indicated active SHG membership.');
      } else {
        ineligibleReasons.push(
          `Requires ${rules.ownership_types.join(' / ').toUpperCase()} ownership; profile lists ${userOwnership}.`
        );
      }
    } else {
      matchedReasons.push(`Ownership type (${userOwnership}) is eligible.`);
    }
  }

  // 5. Sector / category check
  if (rules.categories && rules.categories.length > 0) {
    if (!userCategory) {
      missingInfoReasons.push('Business category is required to verify sector eligibility.');
    } else if (!rules.categories.includes(userCategory)) {
      ineligibleReasons.push(
        `Sector-specific scheme for ${rules.categories.join(', ')}; your business category is ${userCategory}.`
      );
    } else {
      matchedReasons.push(`Sector match (${userCategory}).`);
    }
  }

  // 6. Funding range check
  if (rules.min_funding_requirement && fundingReq > 0 && fundingReq < rules.min_funding_requirement) {
    ineligibleReasons.push(
      `Minimum loan/project size is ₹${rules.min_funding_requirement.toLocaleString('en-IN')}; your funding requirement is ₹${fundingReq.toLocaleString('en-IN')}.`
    );
  }
  if (rules.max_funding_requirement && fundingReq > rules.max_funding_requirement) {
    ineligibleReasons.push(
      `Scheme ceiling is ₹${rules.max_funding_requirement.toLocaleString('en-IN')}; your funding requirement is ₹${fundingReq.toLocaleString('en-IN')}.`
    );
  }

  // 7. Udyam / registration check
  if (rules.requires_udyam_or_registration && !hasUdyam) {
    missingInfoReasons.push(
      'Requires Udyam Registration. You can register for free on udyamregistration.gov.in before applying.'
    );
  } else if (rules.requires_udyam_or_registration && hasUdyam) {
    matchedReasons.push('Udyam registration requirement satisfied.');
  }

  // 8. Income / age / SHG extra consented fields
  if (rules.max_family_income) {
    if (!user.consent_scheme_matching || extra?.annual_family_income == null) {
      missingInfoReasons.push(
        `Requires annual family income verification (limit ≤ ₹${rules.max_family_income.toLocaleString('en-IN')}). Provide optional income info with consent to evaluate.`
      );
    } else if (Number(extra.annual_family_income) > rules.max_family_income && extra.social_category === 'general') {
      ineligibleReasons.push(
        `General category family income exceeds limit for this subsidy (entered ₹${Number(extra.annual_family_income).toLocaleString('en-IN')}).`
      );
    } else {
      matchedReasons.push('Annual family income fits scheme norms.');
    }
  }

  if (rules.min_age || rules.max_age) {
    missingInfoReasons.push(
      `Applicant age (${rules.min_age || 18}–${rules.max_age || 65} years) must be verified via Aadhaar/KYC at application.`
    );
  }

  let outcome = 'Potentially eligible';
  if (ineligibleReasons.length > 0) {
    outcome = 'Currently ineligible';
  } else if (missingInfoReasons.length > 0) {
    outcome = 'Additional information required';
  }

  return {
    outcome,
    matchedReasons,
    ineligibleReasons,
    missingInfoReasons,
    disclaimer:
      'Preliminary match based on your profile and published scheme criteria. Final eligibility and sanction are decided solely by the implementing authority/bank.',
  };
}
