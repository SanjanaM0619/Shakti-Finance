import mongoose from 'mongoose';

const surplusAllocationSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // user_id
    user_id: { type: String, required: true, unique: true, index: true },
    upcoming_obligations: { type: Number, default: 0 },
    emergency_reserves: { type: Number, default: 0 },
    business_reinvestment: { type: Number, default: 0 },
    personal_savings: { type: Number, default: 0 },
    flexible_spending: { type: Number, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, versionKey: false }
);

export const SurplusAllocation = mongoose.model('SurplusAllocation', surplusAllocationSchema);
