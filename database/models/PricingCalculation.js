import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const pricingCalculationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => uuidv4() },
    user_id: { type: String, required: true, index: true },
    product_name: { type: String, required: true },
    batch_units: { type: Number, default: 1 },
    raw_materials: { type: Number, default: 0 },
    labour: { type: Number, default: 0 },
    packaging: { type: Number, default: 0 },
    transportation: { type: Number, default: 0 },
    other_costs: { type: Number, default: 0 },
    desired_selling_price: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false }, id: false, versionKey: false }
);

pricingCalculationSchema.virtual('id').get(function () {
  return this._id;
});
pricingCalculationSchema.set('toJSON', { virtuals: true });
pricingCalculationSchema.set('toObject', { virtuals: true });

export const PricingCalculation = mongoose.model('PricingCalculation', pricingCalculationSchema);
