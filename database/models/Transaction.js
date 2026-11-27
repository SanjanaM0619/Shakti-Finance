import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const transactionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true, index: true },
    client_tx_id: { type: String, default: null },
    tx_date: { type: String, required: true },
    entry_kind: {
      type: String,
      required: true,
      enum: [
        'sale',
        'expense',
        'household_withdrawal',
        'personal_contribution',
        'loan_received',
        'loan_repayment',
        'account_transfer',
        'capital_contribution',
        'adjustment',
      ],
    },
    item_name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    quantity: { type: Number, default: 1 },
    unit_price: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    payment_method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'credit'],
      default: 'cash',
    },
    account_target: { type: String, enum: ['cash', 'upi', 'bank'], default: 'cash' },
    transfer_to_account: { type: String, default: null },
    customer_id: { type: String, default: null },
    supplier_id: { type: String, default: null },
    due_date: { type: String, default: null },
    paid_amount: { type: Number, default: 0 },
    settlement_status: { type: String, enum: ['paid', 'partial', 'unpaid'], default: 'paid' },
    is_recurring: { type: Number, default: 0 },
    recurring_interval: { type: String, default: null },
    receipt_path: { type: String, default: null },
    notes: { type: String, default: '' },
    source: { type: String, default: 'manual' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, id: false, versionKey: false }
);

transactionSchema.index({ user_id: 1, tx_date: -1 });
transactionSchema.index({ user_id: 1, entry_kind: 1 });
transactionSchema.index(
  { user_id: 1, client_tx_id: 1 },
  { unique: true, partialFilterExpression: { client_tx_id: { $type: 'string' } } }
);

transactionSchema.virtual('id').get(function () {
  return this._id;
});
transactionSchema.set('toJSON', { virtuals: true });
transactionSchema.set('toObject', { virtuals: true });

export const Transaction = mongoose.model('Transaction', transactionSchema);
