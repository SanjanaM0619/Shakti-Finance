import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const supplierSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    category: { type: String, default: 'Raw materials' },
    notes: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, id: false, versionKey: false }
);

supplierSchema.virtual('id').get(function () {
  return this._id;
});
supplierSchema.set('toJSON', { virtuals: true });
supplierSchema.set('toObject', { virtuals: true });

export const Supplier = mongoose.model('Supplier', supplierSchema);
