/**
 * Voice-First Regional-Language Transaction Extraction Engine (Kannada & English)
 * Supports optional OpenAI / Sarvam AI when configured in environment variables,
 * and falls back cleanly to a deterministic bilingual rule-based parser so the feature
 * always works reliably without hallucinating or directly writing to financial balances.
 */

const EXPENSE_KEYWORDS = [
  { keywords: ['ingredient', 'ingredients', 'flour', 'ragi', 'rice', 'oil', 'milk', 'sugar', 'spice', 'spices', 'vegetable', 'vegetables', 'raw material', 'materials', 'ಸಾಮಗ್ರಿ', 'ಕಚ್ಚಾ', 'ಎಣ್ಣೆ', 'ಹಿಟ್ಟು', 'ತರಕಾರಿ'], category: 'Raw materials' },
  { keywords: ['pack', 'packaging', 'pouch', 'box', 'label', 'bag', 'ಪ್ಯಾಕಿಂಗ್', 'ಕವರ್'], category: 'Packaging' },
  { keywords: ['auto', 'transport', 'delivery', 'petrol', 'diesel', 'bus', 'tempo', 'ಸಾಗಾಣಿಕೆ', 'ಆಟೋ', 'ಡೀಸೆಲ್'], category: 'Transportation' },
  { keywords: ['electricity', 'current', 'power', 'bill', 'ವಿದ್ಯುತ್', 'ಕರೆಂಟ್'], category: 'Electricity' },
  { keywords: ['rent', 'shop rent', 'ಬಾಡಿಗೆ'], category: 'Rent' },
  { keywords: ['labour', 'labor', 'salary', 'wage', 'wages', 'helper', 'worker', 'ಕೂಲಿ', 'ಸಂಬಳ'], category: 'Labour' },
  { keywords: ['repair', 'maintenance', 'service', 'ರಿಪೇರಿ'], category: 'Maintenance' },
  { keywords: ['machine', 'equipment', 'mixer', 'grinder', 'sewing', 'ಯಂತ್ರ'], category: 'Equipment' },
  { keywords: ['ad', 'ads', 'marketing', 'banner', 'pamphlet', 'ಪ್ರಚಾರ'], category: 'Marketing' },
];

const SALE_VERBS = ['sold', 'sale', 'sales', 'earned', 'income', 'received from customer', 'ಮಾರಾಟ', 'ಮಾರಿದೆ', 'ಬಂದಿದೆ', 'ಆದಾಯ'];
const EXPENSE_VERBS = ['spent', 'bought', 'purchased', 'paid for', 'expense', 'cost', 'ಖರ್ಚು', 'ಕೊಂಡೆ', 'ಕೊಟ್ಟೆ', 'ಖರೀದಿ'];
const HOUSEHOLD_KEYWORDS = ['household', 'home', 'family', 'grocery', 'school fee', 'personal', 'ಮನೆ ಖರ್ಚು', 'ಮನೆಗೆ', 'ಕುಟುಂಬ'];
const CONTRIBUTION_KEYWORDS = ['added personal', 'own money', 'invested my', 'put my own', 'ಸ್ವಂತ ಹಣ', 'ಬಂಡವಾಳ'];

function detectPaymentMethod(clause) {
  const lower = clause.toLowerCase();
  if (/upi|gpay|google pay|phonepe|paytm|qr|ಯುಪಿಐ|ಫೋನ್ ಪೇ/.test(lower)) return 'upi';
  if (/bank|neft|imps|transfer|account|ಬ್ಯಾಂಕ್/.test(lower)) return 'bank_transfer';
  if (/credit|udhaar|udhar|later|pending|due|ಸಾಲ|ಬಾಕಿ/.test(lower)) return 'credit';
  if (/cash|ನಗದು|ಕೈಯಲ್ಲಿ/.test(lower)) return 'cash';
  return null;
}

function detectDate(text) {
  const lower = text.toLowerCase();
  const d = new Date();
  if (/yesterday|ನಿನ್ನೆ/.test(lower)) {
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  const isoMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];
  return d.toISOString().slice(0, 10);
}

function extractAmount(clause) {
  // Prefer numbers with currency or standalone large numbers avoiding quantity before units like "20 packets"
  const cleaned = clause.replace(/,/g, '');
  const currencyMatch = cleaned.match(/(?:₹|rs\.?|inr|rupees?|ರೂಪಾಯಿ|ರೂ)\s*(\d+(?:\.\d+)?)/i)
    || cleaned.match(/(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees?|ರೂಪಾಯಿ|ರೂ)/i);
  if (currencyMatch) return Number(currencyMatch[1]);

  const nums = [...cleaned.matchAll(/\b(\d+(?:\.\d+)?)\b/g)].map((m) => Number(m[1]));
  if (nums.length === 0) return null;
  // If multiple numbers (e.g. "20 packets for 2000"), the largest or last is typically total amount
  return nums[nums.length - 1];
}

function extractQuantity(clause) {
  const qtyMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:packets?|pcs|pieces?|kg|kilos?|jars?|boxes?|units?|litres?|liters?|ಪ್ಯಾಕೆಟ್|ಕೆಜಿ)/i);
  return qtyMatch ? Number(qtyMatch[1]) : 1;
}

function inferExpenseCategory(clause) {
  const lower = clause.toLowerCase();
  for (const rule of EXPENSE_KEYWORDS) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return 'Other business expenses';
}

function cleanItemName(clause, fallback) {
  const cleaned = clause
    .replace(/(?:today|yesterday|i|sold|spent|bought|purchased|paid|for|on|via|by|using|through|rupees?|rs\.?|inr|₹|cash|upi|credit|bank transfer|ಮತ್ತು|ಇಂದು|ನಿನ್ನೆ|ನಾನು|ರೂಪಾಯಿ)/gi, ' ')
    .replace(/\b\d+(?:,\d+)*(?:\.\d+)?\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1, 60);
  }
  return fallback;
}

export function deterministicParseTranscript(transcript, language = 'en') {
  const normalized = (transcript || '').trim();
  if (!normalized) {
    return {
      transactions: [],
      clarificationQuestions: [
        language === 'kn'
          ? 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮಾರಾಟ ಅಥವಾ ಖರ್ಚಿನ ವಿವರವನ್ನು ಹೇಳಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.'
          : 'Please speak or type your sale or expense details (for example: "Sold 20 snack packets for 2000 rupees via UPI").',
      ],
      parserMode: 'deterministic-bilingual',
    };
  }

  const txDate = detectDate(normalized);
  // Split multi-clause sentences like "Sold 20 packets for 2000 and spent 600 on ingredients"
  const clauses = normalized
    .split(/(?:\b(?:and also|and|then|plus)\b|\s+ಮತ್ತು\s+|[.;]+)/i)
    .map((c) => c.trim())
    .filter((c) => c.length > 2);

  const transactions = [];
  const clarificationQuestions = [];

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    const isHousehold = HOUSEHOLD_KEYWORDS.some((k) => lower.includes(k));
    const isContribution = CONTRIBUTION_KEYWORDS.some((k) => lower.includes(k));
    const isSale = SALE_VERBS.some((k) => lower.includes(k));
    const isExpense = EXPENSE_VERBS.some((k) => lower.includes(k));

    let entryKind = null;
    if (isHousehold) entryKind = 'household_withdrawal';
    else if (isContribution) entryKind = 'personal_contribution';
    else if (isSale && !isExpense) entryKind = 'sale';
    else if (isExpense && !isSale) entryKind = 'expense';
    else if (isSale) entryKind = 'sale';
    else if (isExpense) entryKind = 'expense';

    const amount = extractAmount(clause);
    const quantity = extractQuantity(clause);
    const detectedMethod = detectPaymentMethod(clause);

    // Skip conjunction fragments without any financial verb or amount
    if (!entryKind && !amount) continue;

    if (!entryKind) {
      clarificationQuestions.push(
        `Was "${clause}" a business sale, business expense, or household withdrawal?`
      );
      entryKind = 'expense';
    }

    if (!amount || amount <= 0) {
      clarificationQuestions.push(
        `What was the exact amount (in ₹) for "${clause}"?`
      );
    }

    if (!detectedMethod) {
      clarificationQuestions.push(
        `Which payment method was used for "${clause}" (Cash, UPI, Bank Transfer, or Credit)? Defaulted to Cash—please verify before saving.`
      );
    }

    const category =
      entryKind === 'sale'
        ? 'Product Sales'
        : entryKind === 'household_withdrawal'
          ? 'Household'
          : entryKind === 'personal_contribution'
            ? 'Capital'
            : inferExpenseCategory(clause);

    const itemName = cleanItemName(
      clause,
      entryKind === 'sale' ? 'Sales Entry' : entryKind === 'household_withdrawal' ? 'Household Withdrawal' : category
    );

    const safeAmount = amount || 0;
    const unitPrice = quantity > 0 && safeAmount > 0 ? Math.round((safeAmount / quantity) * 100) / 100 : safeAmount;

    transactions.push({
      entry_kind: entryKind,
      tx_date: txDate,
      item_name: itemName,
      category,
      quantity,
      unit_price: unitPrice,
      amount: safeAmount,
      payment_method: detectedMethod || 'cash',
      payment_method_inferred: !detectedMethod,
      confidence: amount && entryKind ? (detectedMethod ? 'high' : 'medium') : 'low',
      raw_clause: clause,
    });
  }

  return {
    transactions,
    clarificationQuestions,
    parserMode: 'deterministic-bilingual',
  };
}

export async function parseVoiceTransaction({ transcript, language = 'en' }) {
  const sysInstruction = `Extract structured bookkeeping transactions from Kannada or English natural speech.
Return ONLY valid JSON: { "transactions": [{ "entry_kind": "sale|expense|household_withdrawal|personal_contribution", "tx_date": "YYYY-MM-DD", "item_name": "string", "category": "string", "quantity": number, "unit_price": number, "amount": number, "payment_method": "cash|upi|bank_transfer|credit" }], "clarificationQuestions": ["string"] }.
Today is ${new Date().toISOString().slice(0, 10)}. Never invent amounts; ask clarification if missing.`;

  if (process.env.GEMINI_API_KEY) {
    try {
      const gemRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${sysInstruction}\n\nLanguage: ${language}. Transcript: ${transcript}` }],
              },
            ],
            generationConfig: { temperature: 0, responseMimeType: 'application/json' },
          }),
        }
      );
      if (gemRes.ok) {
        const data = await gemRes.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
            clarificationQuestions: Array.isArray(parsed.clarificationQuestions) ? parsed.clarificationQuestions : [],
            parserMode: 'gemini-llm',
          };
        }
      }
    } catch {
      // Fall through to OpenAI or deterministic bilingual parser
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: sysInstruction },
            { role: 'user', content: `Language: ${language}. Transcript: ${transcript}` },
          ],
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          clarificationQuestions: Array.isArray(parsed.clarificationQuestions) ? parsed.clarificationQuestions : [],
          parserMode: 'openai-llm',
        };
      }
    } catch {
      // Fall back gracefully to deterministic bilingual parser
    }
  }

  return deterministicParseTranscript(transcript, language);
}
