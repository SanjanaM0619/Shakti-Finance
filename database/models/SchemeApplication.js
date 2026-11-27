import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const schemeApplicationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true },
    scheme_id: { type: String, required: true },
    status: { type: String, default: 'preparing' },
    checklist_progress_json: { type: String, default: '{}' },
    notes: { type: String, default: '' },
    deadline_date: { type: String, default: null },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' }, id: false, versionKey: false }
);

schemeApplicationSchema.index({ user_id: 1, scheme_id: 1 }, { unique: true });
schemeApplicationSchema.virtual('id').get(function () {
  return this._id;
});
schemeApplicationSchema.set('toJSON', { virtuals: true });
schemeApplicationSchema.set('toObject', { virtuals: true });

export const SchemeApplication = mongoose.model('SchemeApplication', schemeApplicationSchema);
