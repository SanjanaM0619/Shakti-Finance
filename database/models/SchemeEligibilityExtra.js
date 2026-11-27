import mongoose from 'mongoose';

const schemeExtraSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // matches user_id
    user_id: { type: String, required: true, unique: true, index: true },
    social_category: { type: String, default: 'general' },
    annual_family_income: { type: Number, default: null },
    education_level: { type: String, default: '' },
    shg_member: { type: Boolean, default: false },
    bank_account_linked: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false }
);

export const SchemeEligibilityExtra = mongoose.model('SchemeEligibilityExtra', schemeExtraSchema);
