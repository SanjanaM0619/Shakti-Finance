import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, default: '', trim: true },
    password_hash: { type: String, required: true },
    preferred_language: { type: String, enum: ['en', 'kn'], default: 'en' },
    location: { type: String, default: '', trim: true },
    consent_privacy: { type: Boolean, default: true },
    consent_notifications: { type: Boolean, default: true },
    consent_scheme_matching: { type: Boolean, default: false },
    is_demo: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, id: false }
);

userSchema.virtual('id').get(function () {
  return this._id;
});
userSchema.set('toJSON', { virtuals: true, versionKey: false });
userSchema.set('toObject', { virtuals: true, versionKey: false });

export const User = mongoose.model('User', userSchema);
