import mongoose from 'mongoose';

const otpSessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // mobile number
    otp_code: { type: String, required: true },
    expires_at: { type: Date, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false }
);

export const OtpSession = mongoose.model('OtpSession', otpSessionSchema);
