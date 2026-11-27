import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const literacyProgressSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true },
    lesson_id: { type: String, required: true },
    completed: { type: Number, default: 0 },
    quiz_score: { type: Number, default: 0 },
    completed_at: { type: String, default: () => new Date().toISOString() },
  },
  { id: false, versionKey: false }
);

literacyProgressSchema.index({ user_id: 1, lesson_id: 1 }, { unique: true });
literacyProgressSchema.virtual('id').get(function () {
  return this._id;
});
literacyProgressSchema.set('toJSON', { virtuals: true });
literacyProgressSchema.set('toObject', { virtuals: true });

export const LiteracyProgress = mongoose.model('LiteracyProgress', literacyProgressSchema);
