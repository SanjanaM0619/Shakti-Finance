import React, { useEffect, useState } from 'react';
import { Calculator, Save } from 'lucide-react';
import { apiFetch, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { t } from '../lib/i18n';

interface PricingCalc {
  id: string;
  product_name: string;
  batch_units: number;
  raw_materials: number;
  labour: number;
  packaging: number;
  transportation: number;
  other_costs: number;
  desired_selling_price: number;
  created_at: string;
}

export const PricingPage: React.FC = () => {
  const { language } = useAuth();
  const [savedList, setSavedList] = useState<PricingCalc[]>([]);
  const [productName, setProductName] = useState('Millet Chakli (200g Pack)');
  const [batchUnits, setBatchUnits] = useState(50);
  const [rawMaterials, setRawMaterials] = useState(1950);
  const [labour, setLabour] = useState(500);
  const [packaging, setPackaging] = useState(350);
  const [transportation, setTransportation] = useState(200);
  const [otherCosts, setOtherCosts] = useState(150);
  const [sellingPrice, setSellingPrice] = useState(90);
  const [msg, setMsg] = useState<string | null>(null);

  const loadSaved = () => {
    apiFetch<{ calculations: PricingCalc[] }>('/api/finance/pricing')
      .then((res) => setSavedList(res.calculations))
      .catch(() => {});
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const totalBatchCost = rawMaterials + labour + packaging + transportation + otherCosts;
  const unitCost = batchUnits > 0 ? totalBatchCost / batchUnits : 0;
  const breakEvenPrice = unitCost;
  const profitPerUnit = sellingPrice - unitCost;
  const marginPct = sellingPrice > 0 ? (profitPerUnit / sellingPrice) * 100 : 0;
  const batchProfit = profitPerUnit * batchUnits;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/finance/pricing', {
      method: 'POST',
      body: JSON.stringify({
        product_name: productName,
        batch_units: batchUnits,
        raw_materials: rawMaterials,
        labour,
        packaging,
        transportation,
        other_costs: otherCosts,
        desired_selling_price: sellingPrice,
      }),
    });
    setMsg('Pricing calculation saved.');
    loadSaved();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t(language, 'pricingTitle')}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {t(language, 'pricingDesc')}
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 card-surface p-6 space-y-4">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600" /> Batch Production Cost Inputs
          </h2>

          {msg && (
            <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
              {msg}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label-text">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Units Produced in Batch *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={batchUnits}
                  onChange={(e) => setBatchUnits(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Raw Materials (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={rawMaterials}
                  onChange={(e) => setRawMaterials(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Labour / Own Time Value (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={labour}
                  onChange={(e) => setLabour(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Packaging & Labels (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={packaging}
                  onChange={(e) => setPackaging(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Transportation / Delivery (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={transportation}
                  onChange={(e) => setTransportation(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Fuel / Electricity / Other (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(Number(e.target.value))}
                  className="input-field"
                />
              </div>
              <div>
                <label className="label-text">Your Target Selling Price / Unit (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  className="input-field border-blue-300"
                />
              </div>
            </div>

            <button type="submit" className="btn-primary w-full">
              <Save className="w-4 h-4" /> Save Pricing Calculation
            </button>
          </form>
        </section>

        <section className="lg:col-span-6 space-y-4">
          <div className="card-surface p-6 space-y-4 border-blue-200 bg-blue-50/30">
            <h2 className="font-semibold text-slate-900">Unit Economics & Break-Even Output</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">Total Batch Cost</p>
                <p className="text-xl font-bold text-slate-900">{formatInr(totalBatchCost)}</p>
              </div>
              <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">Break-Even Price / Unit</p>
                <p className="text-xl font-bold text-blue-700">₹{breakEvenPrice.toFixed(2)}</p>
              </div>
              <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                <p className="text-xs text-slate-500">Expected Profit / Unit</p>
                <p className={`text-xl font-bold ${profitPerUnit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  ₹{profitPerUnit.toFixed(2)} ({marginPct.toFixed(1)}%)
                </p>
              </div>
              <div className="p-3.5 bg-blue-600 text-white rounded-lg">
                <p className="text-xs text-blue-100">Total Profit per Batch</p>
                <p className="text-xl font-bold">{formatInr(batchProfit)}</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-white p-3.5 rounded-lg border border-slate-200 space-y-1">
              <p className="font-semibold text-slate-900">Visible Assumptions</p>
              <p>• Break-even assumes all {batchUnits} units in the batch are sold with zero spoilage.</p>
              <p>• Fixed shop rent or loan EMIs are not included unless added under "Other Costs".</p>
              <p>• Suggested 25% healthy margin selling price: <strong>₹{(unitCost / 0.75).toFixed(2)}</strong> / unit.</p>
            </div>
          </div>

          {savedList.length > 0 && (
            <div className="card-surface p-5 space-y-2">
              <h3 className="text-sm font-semibold text-slate-900">Saved Product Pricing</h3>
              <div className="space-y-2">
                {savedList.slice(0, 4).map((item) => {
                  const total =
                    item.raw_materials + item.labour + item.packaging + item.transportation + item.other_costs;
                  const unit = total / Math.max(1, item.batch_units);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setProductName(item.product_name);
                        setBatchUnits(item.batch_units);
                        setRawMaterials(item.raw_materials);
                        setLabour(item.labour);
                        setPackaging(item.packaging);
                        setTransportation(item.transportation);
                        setOtherCosts(item.other_costs);
                        setSellingPrice(item.desired_selling_price);
                      }}
                      className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-blue-200 cursor-pointer flex justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-800">{item.product_name}</span>
                      <span className="text-slate-600">
                        Cost ₹{unit.toFixed(1)} → Price ₹{item.desired_selling_price}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
