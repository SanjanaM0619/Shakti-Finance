import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const settlementPaymentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true, index: true },
    transaction_id: { type: String, required: true, index: true },
    party_type: { type: String, enum: ['customer', 'supplier'], required: true },
    party_id: { type: String, default: null },
    amount: { type: Number, required: true },
    payment_method: { type: String, default: 'cash' },
    payment_date: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, id: false, versionKey: false }
);

settlementPaymentSchema.virtual('id').get(function () {
  return this._id;
});
settlementPaymentSchema.set('toJSON', { virtuals: true });
settlementPaymentSchema.set('toObject', { virtuals: true });

export const SettlementPayment = mongoose.model('SettlementPayment', settlementPaymentSchema);
