import mongoose from 'mongoose';

const notificationReadSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // `${user_id}:${notification_id}`
    user_id: { type: String, required: true, index: true },
    notification_id: { type: String, required: true },
    is_read: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, versionKey: false }
);

notificationReadSchema.index({ user_id: 1, notification_id: 1 }, { unique: true });

export const NotificationRead = mongoose.model('NotificationRead', notificationReadSchema);
