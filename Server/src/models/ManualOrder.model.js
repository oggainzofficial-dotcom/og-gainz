const mongoose = require('mongoose');

const ManualOrderItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    sourceId: { type: mongoose.Schema.Types.ObjectId, required: false },
    type: { type: String, required: true, enum: ['meal', 'addon', 'byo'] },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unit_price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 },
    subscription_type: { type: String, required: false, enum: ['trial', 'weekly', 'monthly'] },
    subscription_days: { type: Number, required: false, min: 1 },
    delivery_time: { type: String, required: false, trim: true },
    start_date: { type: String, required: false, trim: true },
  },
  { _id: false }
);

const ManualOrderAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    changedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    changedAt: { type: Date, required: true, default: Date.now },
    changes: { type: Object, required: false },
  },
  { _id: false }
);

const ManualOrderSchema = new mongoose.Schema(
  {
    manual_order_id: { type: String, required: true, unique: true, index: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false, index: true },

    customer_name: { type: String, required: true, trim: true },
    phone_number: { type: String, required: true, trim: true },
    whatsapp_number: { type: String, required: false, trim: true },
    address: { type: String, required: true, trim: true },
    notes: { type: String, required: false, trim: true },

    distance_km: { type: Number, required: true, min: 0 },
    delivery_cost_per_km: { type: Number, required: true, min: 0 },
    single_delivery_cost: { type: Number, required: true, min: 0 },

    deliveries_per_day: { type: Number, required: true, min: 1 },
    delivery_time: { type: String, required: true, trim: true },

    subscription_type: { type: String, required: true, enum: ['trial', 'weekly', 'monthly'] },
    subscription_days: { type: Number, required: true, min: 1 },
    start_date: { type: String, required: true, trim: true },

    meal_items: { type: [ManualOrderItemSchema], required: true, default: [] },
    addon_items: { type: [ManualOrderItemSchema], required: true, default: [] },
    byo_items: { type: [ManualOrderItemSchema], required: true, default: [] },

    meal_cost: { type: Number, required: true, min: 0 },
    addon_cost: { type: Number, required: true, min: 0 },
    byo_cost: { type: Number, required: true, min: 0 },
    delivery_cost_total: { type: Number, required: true, min: 0 },
    discount_percentage: { type: Number, required: true, min: 0, max: 100, default: 0 },
    discount_amount: { type: Number, required: true, min: 0, default: 0 },
    grand_total: { type: Number, required: true, min: 0 },

    payment_status: { type: String, required: true, enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' },
    order_status: { type: String, required: true, enum: ['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'IN_KITCHEN'], default: 'PENDING_PAYMENT' },

    created_by_admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    paid_by_admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },

    order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: false },
    moved_to_kitchen_at: { type: Date, required: false },

    bill_svg: { type: String, required: false },
    bill_html: { type: String, required: false },
    bill_generated_at: { type: Date, required: false },

    audit_log: { type: [ManualOrderAuditSchema], required: false, default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

module.exports = mongoose.model('ManualOrder', ManualOrderSchema);
