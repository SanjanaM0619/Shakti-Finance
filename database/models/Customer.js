import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const customerSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, id: false, versionKey: false }
);

customerSchema.virtual('id').get(function () {
  return this._id;
});
customerSchema.set('toJSON', { virtuals: true });
customerSchema.set('toObject', { virtuals: true });

export const Customer = mongoose.model('Customer', customerSchema);
