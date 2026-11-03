'use strict';
const assert = require('assert');
const { orderAmounts, amountText } = require('../lib/order-amounts');

// real order 2026110133580840 (EN store, US customer): the charged amount is total_price, not current_total_price
const real = { current_subtotal_price: 2173.5, current_total_price: 2173.5, current_promotion_price: -1173.69, current_coupon_price: 0, current_shipping_price: 0, total_price: 999.81 };
assert.deepStrictEqual(orderAmounts(real), { paid: '999.81', gross: '2173.50', off: '1173.69' });
assert.strictEqual(amountText(real, 'USD'), '999.81 USD（折扣前 2173.50，优惠 -1173.69）');

// ES order 2026110233632662: 7 x 18.90 with the stacked rebate -40.81 -> 91.49
assert.strictEqual(orderAmounts({ current_subtotal_price: 132.3, current_total_price: 132.3, current_promotion_price: -40.81, total_price: 91.49 }).paid, '91.49');

// no discount: just the amount, no breakdown
const plain = { current_subtotal_price: 53.8, current_total_price: 53.8, current_promotion_price: 0, total_price: 53.8 };
assert.strictEqual(amountText(plain, 'EUR'), '53.80 EUR');

// total_price missing: derive it from the pre-promotion total minus the discounts
assert.strictEqual(orderAmounts({ current_total_price: 100, current_promotion_price: -10, current_coupon_price: -5 }).paid, '85.00');
// nothing usable: empty strings, no crash
assert.deepStrictEqual(orderAmounts({}), { paid: '', gross: '', off: '0.00' });
console.log('order-amounts: all checks passed');
