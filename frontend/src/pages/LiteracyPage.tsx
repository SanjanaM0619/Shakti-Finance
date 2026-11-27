import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Award } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';
import { FinancialSummary } from '../types';

interface Lesson {
  id: string;
  titleEn: string;
  titleKn: string;
  summaryEn: string;
  summaryKn: string;
  contextualInsight: (s: FinancialSummary | null) => string;
  quizQuestion: string;
  options: string[];
  correctIdx: number;
}

const LESSONS: Lesson[] = [
  {
    id: 'rev-vs-profit',
    titleEn: '1. Revenue vs Profit (Operating Surplus)',
    titleKn: '೧. ಒಟ್ಟು ಮಾರಾಟ (Revenue) ಮತ್ತು ನಿಜವಾದ ಲಾಭ (Profit)',
    summaryEn:
      'Total sales cash coming into your shop is Revenue—not Profit. Profit is what remains only after deducting raw materials, electricity, rent, packaging, and helper wages.',
    summaryKn:
      'ಅಂಗಡಿಗೆ ಬರುವ ಒಟ್ಟು ಮಾರಾಟದ ಹಣವೇ ಲಾಭವಲ್ಲ. ಕಚ್ಚಾ ಸಾಮಗ್ರಿ, ವಿದ್ಯುತ್, ಪ್ಯಾಕಿಂಗ್ ಮತ್ತು ಕೂಲಿ ಖರ್ಚುಗಳನ್ನು ಕಳೆದ ನಂತರ ಉಳಿಯುವುದೇ ನಿಜವಾದ ವ್ಯಾಪಾರದ ಲಾಭ.',
    contextualInsight: (s) =>
      s
        ? `In your business, total sales are ${formatInr(s.totalRevenue)}, operating costs are ${formatInr(s.totalOperatingExpenses)}, so your true operating surplus is ${formatInr(s.operatingSurplus)} (${s.profitMarginPct}% margin).`
        : 'Record sales and expenses to see your real profit margin.',
    quizQuestion: 'If you sell snacks for ₹5,000 and spend ₹3,200 on ingredients & gas, what is your operating surplus?',
    options: ['₹5,000', '₹1,800', '₹8,200'],
    correctIdx: 1,
  },
  {
    id: 'fixed-vs-variable',
    titleEn: '2. Fixed vs Variable Expenses',
    titleKn: '೨. ಸ್ಥಿರ ಖರ್ಚು ಮತ್ತು ಬದಲಾಗುವ ಖರ್ಚು',
    summaryEn:
      'Variable costs (flour, oil, pouches) rise every time you produce more packets. Fixed costs (shop rent, EMI) stay the same even in a slow week.',
    summaryKn:
      'ನೀವು ಹೆಚ್ಚು ಪ್ಯಾಕೆಟ್ ತಯಾರಿಸಿದಂತೆ ಕಚ್ಚಾ ಸಾಮಗ್ರಿ ಮತ್ತು ಪ್ಯಾಕಿಂಗ್ ಖರ್ಚು ಹೆಚ್ಚಾಗುತ್ತದೆ (ಬದಲಾಗುವ ಖರ್ಚು). ಬಾಡಿಗೆ ಮತ್ತು ಇಎಂಐ ಪ್ರತಿ ತಿಂಗಳು ಒಂದೇ ಇರುತ್ತದೆ (ಸ್ಥಿರ ಖರ್ಚು).',
    contextualInsight: (s) =>
      s && s.expenseByCategory[0]
        ? `Your largest expense right now is ${s.expenseByCategory[0].category} (${formatInr(s.expenseByCategory[0].amount)}). Bulk buying can lower unit variable cost.`
        : 'Categorizing expenses highlights where variable costs grow.',
    quizQuestion: 'Which of these is a variable expense for a food processing unit?',
    options: ['Cooking oil & millet flour', 'Monthly workshop rent', 'Loan EMI'],
    correctIdx: 0,
  },
  {
    id: 'working-capital',
    titleEn: '3. Working Capital & Credit Traps',
    titleKn: '೩. ದೈನಂದಿನ ಚಾಲನಾ ಬಂಡವಾಳ (Working Capital)',
    summaryEn:
      'Working capital keeps daily operations running. When too much money is stuck in unpaid customer credit, you may run out of cash to buy raw materials.',
    summaryKn:
      'ಗ್ರಾಹಕರ ಬಾಕಿ ಹಣ ಹೆಚ್ಚಾದರೆ ವ್ಯಾಪಾರದಲ್ಲಿ ಲಾಭ ಕಂಡರೂ ಸಾಮಗ್ರಿ ತರಲು ಕೈಯಲ್ಲಿ ನಗದು ಇರುವುದಿಲ್ಲ. ಆದ್ದರಿಂದ ಬಾಕಿ ವಸೂಲಿ ಮುಖ್ಯ.',
    contextualInsight: (s) =>
      s
        ? `Your current Working Capital is ${formatInr(s.workingCapital)}, with ${formatInr(s.accountsReceivable)} awaiting collection from customers.`
        : 'Track receivables and payables to protect working capital.',
    quizQuestion: 'Should uncollected customer credit be counted as cash available to spend today?',
    options: ['Yes, always', 'No, only after the payment is received', 'Only if due next month'],
    correctIdx: 1,
  },
  {
    id: 'household-separation',
    titleEn: '4. Separating Household & Business Cash',
    titleKn: '೪. ಮನೆ ಖರ್ಚು ಮತ್ತು ವ್ಯಾಪಾರದ ಹಣ ಬೇರ್ಪಡಿಸುವುದು',
    summaryEn:
      'Taking ₹3,000 for family groceries is a Household Withdrawal—not a business expense. Recording it separately prevents false losses while showing how much cash stays in the business.',
    summaryKn:
      'ಮನೆ ಖರ್ಚಿಗೆ ತೆಗೆದುಕೊಂಡ ಹಣವನ್ನು ವ್ಯಾಪಾರದ ಖರ್ಚಿನಲ್ಲಿ ಸೇರಿಸಬೇಡಿ. ಅದನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಬರೆದರೆ ವ್ಯಾಪಾರ ಲಾಭದಲ್ಲಿದೆಯೇ ಎಂದು ಸ್ಪಷ್ಟವಾಗಿ ತಿಳಿಯುತ್ತದೆ.',
    contextualInsight: (s) =>
      s
        ? `You have recorded ${formatInr(s.householdWithdrawals)} in separated household withdrawals so far.`
        : 'Use the Business vs Home tab to track family withdrawals cleanly.',
    quizQuestion: 'How should money taken from the cash box for school fees be recorded?',
    options: ['As Raw Materials expense', 'As Household Withdrawal', 'Ignore it'],
    correctIdx: 1,
  },
  {
    id: 'cashflow-mgmt',
    titleEn: '5. Cash-Flow Management & Timing',
    titleKn: '೫. ನಗದು ಹರಿವು (Cash Flow) ನಿರ್ವಹಣೆ',
    summaryEn:
      'A profitable business can still face a cash crunch if supplier bills are due before customers pay you.',
    summaryKn:
      'ಗ್ರಾಹಕರಿಂದ ಹಣ ಬರುವ ಮೊದಲೇ ಪೂರೈಕೆದಾರರ ಬಿಲ್ ಕಟ್ಟಬೇಕಾದರೆ ಲಾಭವಿದ್ದರೂ ನಗದು ಕೊರತೆ ಬರಬಹುದು.',
    contextualInsight: (s) =>
      s
        ? `You have ${formatInr(s.upcomingSupplierObligations30d)} in supplier bills due within 30 days against ${formatInr(s.availableCash)} available cash.`
        : 'Check the 30-day Cash Forecast weekly.',
    quizQuestion: 'What helps prevent unexpected mid-month cash shortages?',
    options: ['Aligning customer credit due dates earlier than supplier bills', 'Never tracking due dates', 'Spending all cash immediately'],
    correctIdx: 0,
  },
  {
    id: 'emergency-savings',
    titleEn: '6. Building an Emergency Business Buffer',
    titleKn: '೬. ತುರ್ತು ನಿಧಿ (Emergency Savings)',
    summaryEn:
      'Keeping 15–30 days of operating expenses in an emergency reserve protects your enterprise during equipment repairs or festival off-seasons.',
    summaryKn:
      'ಯಂತ್ರ ರಿಪೇರಿ ಅಥವಾ ಮಾರಾಟ ಕಡಿಮೆ ಇರುವ ಸಮಯದಲ್ಲಿ ವ್ಯಾಪಾರ ನಿಲ್ಲದಂತೆ ಕನಿಷ್ಠ 15–30 ದಿನಗಳ ಖರ್ಚಿನಷ್ಟು ತುರ್ತು ನಿಧಿ ಇಡಬೇಕು.',
    contextualInsight: (s) =>
      s
        ? `Your post-obligation emergency buffer covers ${s.emergencyBufferCoveragePct}% of your ${formatInr(s.emergencyReserveGoal)} reserve goal.`
        : 'Set your emergency goal in Business Profile.',
    quizQuestion: 'Why keep an emergency reserve separate from daily spending?',
    options: ['To avoid high-interest emergency borrowing during slow weeks', 'To inflate sales figures', 'It is required by GST'],
    correctIdx: 0,
  },
  {
    id: 'debt-interest',
    titleEn: '7. Understanding Debt, Interest & Subvention',
    titleKn: '೭. ಸಾಲ, ಬಡ್ಡಿ ಮತ್ತು ಸರ್ಕಾರಿ ಬಡ್ಡಿ ರಿಯಾಯಿತಿ',
    summaryEn:
      'Always compare effective annual interest rates and EMI burden against monthly operating surplus. Institutional schemes like MUDRA, DAY-NRLM, and KSFC subvention cost far less than informal lenders.',
    summaryKn:
      'ಖಾಸಗಿ ಸಾಲಕ್ಕಿಂತ ಮುದ್ರಾ, ಎನ್‌ಆರ್‌ಎಲ್‌ಎಂ ಅಥವಾ ಕೆಎಸ್‌ಎಫ್‌ಸಿ ಯೋಜನೆಗಳ ಬಡ್ಡಿ ದರ ಬಹಳ ಕಡಿಮೆ ಇರುತ್ತದೆ.',
    contextualInsight: (s) =>
      s
        ? `Your monthly EMI commitment is ${formatInr(s.monthlyLoanEmi)} compared to ${formatInr(s.operatingSurplus)} total operating surplus.`
        : 'Check Govt Schemes for low-interest credit.',
    quizQuestion: 'Before taking a business loan, what should monthly EMI comfortably fit inside?',
    options: ['Reliable monthly operating surplus after household needs', 'Uncollected customer credit', 'Gross revenue only'],
    correctIdx: 0,
  },
  {
    id: 'pricing-profitability',
    titleEn: '8. Pricing & Unit Profitability',
    titleKn: '೮. ಸರಿಯಾದ ಬೆಲೆ ನಿಗದಿ ಮತ್ತು ಲಾಭಾಂಶ',
    summaryEn:
      'Underpricing happens when packaging, transport, fuel, and your own labour are forgotten in product cost.',
    summaryKn:
      'ಪ್ಯಾಕಿಂಗ್, ಸಾಗಾಣಿಕೆ ಮತ್ತು ನಿಮ್ಮ ಶ್ರಮದ ಮೌಲ್ಯವನ್ನು ಸೇರಿಸದೆ ಬೆಲೆ ಇಟ್ಟರೆ ಮಾರಾಟ ಹೆಚ್ಚಾದರೂ ನಷ್ಟವಾಗಬಹುದು.',
    contextualInsight: () => 'Use the Business Pricing Calculator to check break-even prices for every product.',
    quizQuestion: 'Which costs belong in unit break-even price?',
    options: ['Raw materials only', 'Raw materials + packaging + labour + transport + fuel', 'Only electricity'],
    correctIdx: 1,
  },
  {
    id: 'business-expansion',
    titleEn: '9. Planning Safe Business Expansion',
    titleKn: '೯. ಸುರಕ್ಷಿತ ವ್ಯಾಪಾರ ವಿಸ್ತರಣೆ',
    summaryEn:
      'Before buying machinery or hiring, test whether existing cash plus subsidized schemes (like PMFME 35% subsidy) cover the cost without draining working capital.',
    summaryKn:
      'ಹೊಸ ಯಂತ್ರ ಖರೀದಿಸುವ ಮೊದಲು ದೈನಂದಿನ ಬಂಡವಾಳಕ್ಕೆ ತೊಂದರೆಯಾಗದಂತೆ ಸಬ್ಸಿಡಿ ಯೋಜನೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.',
    contextualInsight: (s) =>
      s
        ? `Your safe uncommitted cash after near-term obligations & planned household draw is ${formatInr(Math.max(0, s.netAfterObligationsAndHousehold))}.`
        : 'Ask the AI Assistant to test equipment affordability.',
    quizQuestion: 'What should remain intact after purchasing new equipment?',
    options: ['Working capital for raw materials and upcoming bills', 'Nothing', 'Only unpaid bills'],
    correctIdx: 0,
  },
  {
    id: 'bookkeeping-discipline',
    titleEn: '10. Daily Bookkeeping Habits',
    titleKn: '೧೦. ದೈನಂದಿನ ಲೆಕ್ಕಪತ್ರ ಶಿಸ್ತು',
    summaryEn:
      'Recording sales and expenses daily—even via a 10-second voice note—builds verifiable history that unlocks MUDRA, CGTMSE, and bank loans.',
    summaryKn:
      'ಪ್ರತಿದಿನ ಧ್ವನಿ ಅಥವಾ ಕೈಯಿಂದ ಲೆಕ್ಕ ಬರೆಯುವುದರಿಂದ ಬ್ಯಾಂಕ್ ಸಾಲ ಮತ್ತು ಸರ್ಕಾರಿ ಯೋಜನೆ ಪಡೆಯುವುದು ಸುಲಭವಾಗುತ್ತದೆ.',
    contextualInsight: (s) =>
      s ? `You currently have ${s.transactionCount} verified transactions in your Shakti Finance ledger.` : 'Start recording daily!',
    quizQuestion: 'How do daily digital records help when applying for a bank loan?',
    options: ['They prove consistent cash flows and strengthen your Financial Readiness Report', 'They replace KYC', 'They guarantee instant approval'],
    correctIdx: 0,
  },
];

export const LiteracyPage: React.FC = () => {
  const { language } = useAuth();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [progress, setProgress] = useState<Record<string, { completed: boolean; quiz_score: number }>>({});
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    apiFetch<FinancialSummary>('/api/finance/summary').then(setSummary).catch(() => {});
    apiFetch<{ progress: Array<{ lesson_id: string; completed: number; quiz_score: number }> }>(
      '/api/intel/literacy/progress'
    )
      .then((res) => {
        const map: Record<string, { completed: boolean; quiz_score: number }> = {};
        for (const p of res.progress) {
          map[p.lesson_id] = { completed: Boolean(p.completed), quiz_score: p.quiz_score };
        }
        setProgress(map);
      })
      .catch(() => {});
  }, []);

  const submitQuiz = async (lesson: Lesson) => {
    const choice = selectedAnswers[lesson.id];
    if (choice === undefined) return;
    const isCorrect = choice === lesson.correctIdx;
    const score = isCorrect ? 100 : 50;
    setFeedback({
      ...feedback,
      [lesson.id]: isCorrect
        ? 'Correct! Lesson marked complete.'
        : `Not quite—the best answer is "${lesson.options[lesson.correctIdx]}".`,
    });
    if (isCorrect) {
      await apiFetch('/api/intel/literacy/progress', {
        method: 'POST',
        body: JSON.stringify({ lesson_id: lesson.id, completed: true, quiz_score: score }),
      });
      setProgress((prev) => ({ ...prev, [lesson.id]: { completed: true, quiz_score: score } }));
    }
  };

  const completedCount = Object.values(progress).filter((p) => p.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t(language, 'literacyTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t(language, 'literacyDesc')}
          </p>
        </div>
        <div className="card-surface px-4 py-2.5 flex items-center gap-2.5">
          <Award className="w-5 h-5 text-blue-600" />
          <div className="text-xs">
            <p className="text-slate-500">Progress</p>
            <p className="font-bold text-slate-900">
              {completedCount} / {LESSONS.length} Lessons Completed
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {LESSONS.map((lesson) => {
          const done = progress[lesson.id]?.completed;
          return (
            <article key={lesson.id} className="card-surface p-6 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                    {language === 'kn' ? lesson.titleKn : lesson.titleEn}
                  </h2>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {language === 'kn' ? lesson.titleEn : lesson.titleKn}
                  </p>
                </div>
                {done && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                <p>{lesson.summaryEn}</p>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {lesson.summaryKn}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-900">
                <strong>Your Business Context: </strong>
                {lesson.contextualInsight(summary)}
              </div>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-900">Quick Check: {lesson.quizQuestion}</p>
                <div className="space-y-1.5">
                  {lesson.options.map((opt, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={`quiz-${lesson.id}`}
                        checked={selectedAnswers[lesson.id] === idx}
                        onChange={() => setSelectedAnswers({ ...selectedAnswers, [lesson.id]: idx })}
                        className="text-blue-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => submitQuiz(lesson)}
                    className="btn-secondary text-xs py-1 px-3"
                  >
                    Check Answer
                  </button>
                  {feedback[lesson.id] && (
                    <span className="text-xs font-medium text-blue-700">{feedback[lesson.id]}</span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
