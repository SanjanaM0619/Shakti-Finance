import mongoose from 'mongoose';

const businessProfileSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // matches user_id
    user_id: { type: String, required: true, unique: true, index: true },
    business_name: { type: String, default: '' },
    category: { type: String, default: 'Food Processing' },
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    state: { type: String, default: 'Karnataka' },
    area_type: { type: String, enum: ['rural', 'urban'], default: 'rural' },
    established_date: { type: String, default: '' },
    enterprise_stage: { type: String, enum: ['new', 'existing'], default: 'existing' },
    ownership_type: { type: String, enum: ['individual', 'partnership', 'shg'], default: 'individual' },
    approx_monthly_revenue: { type: Number, default: 0 },
    approx_monthly_expenses: { type: Number, default: 0 },
    employees_count: { type: Number, default: 1 },
    registration_status: { type: String, default: 'unregistered' },
    gst_status: { type: String, default: 'not_registered' },
    udyam_status: { type: String, default: 'not_registered' },
    funding_requirement: { type: Number, default: 0 },
    growth_goals: { type: String, default: '' },
    existing_loan_balance: { type: Number, default: 0 },
    monthly_loan_emi: { type: Number, default: 0 },
    planned_household_withdrawal: { type: Number, default: 0 },
    emergency_reserve_goal: { type: Number, default: 15000 },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false }
);

export const BusinessProfile = mongoose.model('BusinessProfile', businessProfileSchema);
