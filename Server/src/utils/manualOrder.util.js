const { normalizeShift, resolveShiftFromTime } = require('./deliveryShift.util');

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const toInt = (value, fallback = 0) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fallback;
  return n;
};

const clampInt = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const v = toInt(value, min);
  return Math.max(min, Math.min(max, v));
};

const toISODate = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return undefined;
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysISO = (iso, days) => {
  const dt = new Date(`${String(iso)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return iso;
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
};

const normalizeTime = (value) => {
  const s = String(value || '').trim();
  return s || undefined;
};

const normalizeSubscriptionDays = ({ subscriptionType, trialDays }) => {
  const type = String(subscriptionType || '').toLowerCase();
  if (type === 'weekly') return 7;
  if (type === 'monthly') return 30;
  if (type === 'trial') {
    const candidate = clampInt(trialDays, 3, 7);
    if ([3, 5, 7].includes(candidate)) return candidate;
    return 3;
  }
  return 1;
};

const formatInr = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 'INR 0.00';
  return `INR ${n.toFixed(2)}`;
};

const computeDeliveryFees = ({ distanceKm, costPerKm, deliveriesPerDay, subscriptionDays }) => {
  const distance = Math.max(0, toNumber(distanceKm));
  const perKm = Math.max(0, toNumber(costPerKm));
  const perDay = Math.max(1, clampInt(deliveriesPerDay, 1));
  const days = Math.max(1, clampInt(subscriptionDays, 1));

  const singleDeliveryCost = distance * perKm;
  const dailyDeliveryFee = singleDeliveryCost * perDay;
  const totalDeliveryFee = dailyDeliveryFee * days;

  return {
    singleDeliveryCost,
    dailyDeliveryFee,
    totalDeliveryFee,
  };
};

const buildDeliverySchedule = ({ startDate, subscriptionDays, deliveriesPerDay, deliveryTime }) => {
  const startISO = toISODate(startDate) || toISODate(new Date());
  const days = Math.max(1, clampInt(subscriptionDays, 1));
  const perDay = Math.max(1, clampInt(deliveriesPerDay, 1));
  const time = normalizeTime(deliveryTime) || '12:00';

  const schedule = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const date = addDaysISO(startISO, dayIndex);
    const shift = normalizeShift(resolveShiftFromTime(time));
    for (let slot = 0; slot < perDay; slot += 1) {
      schedule.push({ date, time, deliveryShift: shift, slot });
    }
  }

  return schedule;
};

const escapeHtml = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const buildManualOrderBillHtml = ({ manualOrder, billId }) => {
  const orderId = manualOrder.manual_order_id || billId || '';
  const paymentStatus = String(manualOrder.payment_status || '').toUpperCase() || 'PENDING';
  const createdAt = manualOrder.created_at || manualOrder.createdAt || new Date();
  const createdDate = toISODate(createdAt) || toISODate(new Date());
  const subtotalBeforeDiscount =
    Number(manualOrder.meal_cost || 0) +
    Number(manualOrder.addon_cost || 0) +
    Number(manualOrder.byo_cost || 0) +
    Number(manualOrder.delivery_cost_total || 0);
  const discountPctRaw = Number.isFinite(Number(manualOrder.discount_percentage))
    ? Number(manualOrder.discount_percentage)
    : (subtotalBeforeDiscount > 0 ? (Number(manualOrder.discount_amount || 0) / subtotalBeforeDiscount) * 100 : 0);
  const discountPct = Math.max(0, Math.min(100, discountPctRaw));
  const discountPctText = Number.isInteger(discountPct) ? String(discountPct) : discountPct.toFixed(2);

  const mealRows = (manualOrder.meal_items || []).map((item) => {
    const plan = String(item.subscription_type || manualOrder.subscription_type || '').toUpperCase();
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="center">Meal</td>
        <td class="center">${escapeHtml(plan)}</td>
        <td class="right">${Number(item.quantity || 0)}</td>
        <td class="right">${formatInr(item.line_total || 0)}</td>
      </tr>
    `;
  }).join('');

  const addonRows = (manualOrder.addon_items || []).map((item) => {
    const plan = String(item.subscription_type || manualOrder.subscription_type || '').toUpperCase();
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="center">Add-on</td>
        <td class="center">${escapeHtml(plan)}</td>
        <td class="right">${Number(item.quantity || 0)}</td>
        <td class="right">${formatInr(item.line_total || 0)}</td>
      </tr>
    `;
  }).join('');

  const byoRows = (manualOrder.byo_items || []).map((item) => {
    const plan = String(item.subscription_type || manualOrder.subscription_type || '').toUpperCase();
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td class="center">BYO</td>
        <td class="center">${escapeHtml(plan)}</td>
        <td class="right">${Number(item.quantity || 0)}</td>
        <td class="right">${formatInr(item.line_total || 0)}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OG Gainz Invoice ${escapeHtml(orderId)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Arial", "Helvetica", sans-serif; margin: 24px; color: #0f172a; }
      .invoice { max-width: 820px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; }
      .header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
      .brand { font-size: 22px; font-weight: 700; letter-spacing: 0.4px; }
      .muted { color: #64748b; font-size: 13px; }
      .status { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #e2e8f0; }
      .status.paid { background: #dcfce7; color: #166534; }
      .status.pending { background: #fef3c7; color: #92400e; }
      .status.cancelled { background: #fee2e2; color: #991b1b; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid #e5e7eb; padding: 10px 8px; font-size: 13px; }
      th { text-align: left; background: #f8fafc; font-weight: 600; }
      td.center { text-align: center; }
      td.right { text-align: right; }
      .totals { margin-top: 16px; display: grid; gap: 6px; }
      .totals div { display: flex; justify-content: space-between; font-size: 13px; }
      .totals .grand { font-weight: 700; font-size: 15px; }
      .section { margin-top: 18px; }
      .label { font-weight: 600; }
      .no-print { margin-top: 16px; }
      @media print { .no-print { display: none; } body { margin: 0; } .invoice { border: none; } }
    </style>
  </head>
  <body>
    <div class="invoice">
      <div class="header">
        <div>
          <div class="brand">OG GAINZ</div>
          <div class="muted">Perumbakkam</div>
          <div class="muted">Payment method: Online payment</div>
        </div>
        <div>
          <div class="muted">Invoice</div>
          <div class="label">${escapeHtml(orderId)}</div>
          <div class="muted">Date: ${escapeHtml(createdDate || '')}</div>
          <div class="status ${paymentStatus === 'PAID' ? 'paid' : paymentStatus === 'CANCELLED' ? 'cancelled' : 'pending'}">
            ${escapeHtml(paymentStatus)}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="label">Customer</div>
        <div>${escapeHtml(manualOrder.customer_name || '')}</div>
        <div class="muted">Phone: ${escapeHtml(manualOrder.phone_number || '')}</div>
        <div class="muted">WhatsApp: ${escapeHtml(manualOrder.whatsapp_number || '')}</div>
        <div class="muted">Address: ${escapeHtml(manualOrder.address || '')}</div>
      </div>

      <div class="section">
        <div class="label">Order Summary</div>
        <div class="muted">Distance: ${Number(manualOrder.distance_km || 0)} km</div>
        <div class="muted">Deliveries/day: ${Number(manualOrder.deliveries_per_day || 0)}</div>
        <div class="muted">Subscription: ${escapeHtml(String(manualOrder.subscription_type || '').toUpperCase())} (${Number(manualOrder.subscription_days || 0)} days)</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="center">Type</th>
            <th class="center">Plan</th>
            <th class="right">Qty</th>
            <th class="right">Line Total</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>

      <div class="totals">
        <div><span>Meal cost</span><span>${formatInr(manualOrder.meal_cost || 0)}</span></div>
        <div><span>Add-on cost</span><span>${formatInr(manualOrder.addon_cost || 0)}</span></div>
        <div><span>BYO cost</span><span>${formatInr(manualOrder.byo_cost || 0)}</span></div>
        <div><span>Total delivery fees</span><span>${formatInr(manualOrder.delivery_cost_total || 0)}</span></div>
        <div><span>Discount Applied</span><span>${discountPctText}%</span></div>
        <div class="grand"><span>Total fees</span><span>${formatInr(manualOrder.grand_total || 0)}</span></div>
      </div>

      <div class="no-print">
        <button onclick="window.print()">Print Invoice</button>
      </div>
    </div>
  </body>
</html>`;
};

module.exports = {
  computeDeliveryFees,
  normalizeSubscriptionDays,
  buildDeliverySchedule,
  buildManualOrderBillHtml,
  toISODate,
  normalizeTime,
};
