import test from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEqual, hashPassword, verifyPassword } from '../src/core/auth.js';
import { getDaysDiffInTimezone, getTimezoneDateParts } from '../src/core/time.js';
import { shouldTriggerReminder } from '../src/services/notify/reminder.js';

test('Asia Shanghai hour window normalizes local midnight', () => {
  const date = new Date('2026-01-01T16:00:00.000Z');
  const parts = getTimezoneDateParts(date, 'Asia/Shanghai');

  assert.equal(parts.hour, 0);
});

test('timezone day diff supports local reminder matching', () => {
  const now = new Date('2026-01-01T16:30:00.000Z');
  const expiry = new Date('2026-01-02T04:00:00.000Z');
  const daysDiff = getDaysDiffInTimezone(expiry, now, 'Asia/Shanghai');

  assert.equal(daysDiff, 0);
  assert.equal(shouldTriggerReminder({ unit: 'day', value: 0 }, daysDiff, 11.5), true);
});

test('password hash verifies and rejects wrong password', async () => {
  const hash = await hashPassword('secret-password');

  assert.equal(await verifyPassword('secret-password', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);
});
