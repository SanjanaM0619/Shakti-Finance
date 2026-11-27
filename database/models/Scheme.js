import mongoose from 'mongoose';

const schemeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // scheme slug id
    name: { type: String, required: true },
    department: { type: String, required: true },
    state: { type: String, required: true },
    category: { type: String, required: true },
    assistance_type: { type: String, required: true },
    summary: { type: String, required: true },
    financial_benefit: { type: String, required: true },
    eligibility_rules: { type: mongoose.Schema.Types.Mixed, required: true },
    required_documents: { type: [String], default: [] },
    application_steps: { type: [String], default: [] },
    official_url: { type: String, required: true },
    opening_date: { type: String, default: null },
    closing_date: { type: String, default: null },
    status: { type: String, default: 'active' },
    last_verified_date: { type: String, required: true },
    source_reference: { type: String, required: true },
  },
  { id: false, versionKey: false }
);

schemeSchema.virtual('id').get(function () {
  return this._id;
});
schemeSchema.set('toJSON', { virtuals: true });
schemeSchema.set('toObject', { virtuals: true });

export const Scheme = mongoose.model('Scheme', schemeSchema);
