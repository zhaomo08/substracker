import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSubscription,
  manualRenewSubscription,
  trimPaymentHistory
} from '../src/data/subscriptions.js';
import { createEnv } from './helpers.js';

test('manual renewal reads config and updates expiry without runtime error', async () => {
  const env = createEnv({
    config: JSON.stringify({ JWT_SECRET: 'secret', PAYMENT_HISTORY_LIMIT: 10 }),
    subscriptions: JSON.stringify([{
      id: 'sub-1',
      name: 'Test',
      expiryDate: '2026-01-01T00:00:00.000Z',
      periodValue: 1,
      periodUnit: 'month',
      subscriptionMode: 'cycle',
      useLunar: false,
      amount: 9,
      currency: 'CNY',
      paymentHistory: [{
        id: 'initial',
        type: 'initial',
        amount: 9,
        date: '2025-12-01T00:00:00.000Z',
        periodEnd: '2026-01-01T00:00:00.000Z'
      }],
      isActive: true,
      autoRenew: true
    }])
  });

  const result = await manualRenewSubscription('sub-1', env, {
    paymentDate: '2026-01-01T00:00:00.000Z',
    periodMultiplier: 1
  });

  assert.equal(result.success, true);
  assert.equal(result.subscription.expiryDate, '2026-02-01T00:00:00.000Z');
  assert.equal(result.subscription.paymentHistory.length, 2);
});

test('payment history trimming preserves initial record', () => {
  const records = [
    { id: 'initial', type: 'initial' },
    ...Array.from({ length: 20 }, (_, index) => ({ id: `auto-${index}`, type: 'auto' }))
  ];
  const trimmed = trimPaymentHistory(records, 10);

  assert.equal(trimmed.length, 10);
  assert.equal(trimmed[0].id, 'initial');
  assert.equal(trimmed.at(-1).id, 'auto-19');
});

test('invalid subscription input returns validation error', async () => {
  const env = createEnv({ config: JSON.stringify({ JWT_SECRET: 'secret' }) });
  const result = await createSubscription({
    name: 'Invalid',
    expiryDate: '2026-01-01T00:00:00.000Z',
    periodValue: 0,
    periodUnit: 'month'
  }, env);

  assert.equal(result.success, false);
  assert.match(result.message, /订阅周期/);
});
