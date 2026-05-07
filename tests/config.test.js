import test from 'node:test';
import assert from 'node:assert/strict';
import { handleGetConfig, handleUpdateConfig } from '../src/api/handlers/config.js';
import { createEnv } from './helpers.js';

test('partial config update preserves existing non-secret fields', async () => {
  const env = createEnv({
    config: JSON.stringify({
      JWT_SECRET: 'secret',
      TG_CHAT_ID: '12345',
      EMAIL_FROM: 'from@example.com',
      EMAIL_TO: 'to@example.com',
      WEBHOOK_TEMPLATE: '{"text":"{{content}}"}',
      TIMEZONE: 'UTC'
    })
  });

  const request = new Request('https://example.com/api/config', {
    method: 'POST',
    body: JSON.stringify({ TIMEZONE: 'Asia/Shanghai' })
  });
  const response = await handleUpdateConfig(request, env);
  assert.equal(response.status, 200);

  const stored = JSON.parse(await env.SUBSCRIPTIONS_KV.get('config'));
  assert.equal(stored.TIMEZONE, 'Asia/Shanghai');
  assert.equal(stored.TG_CHAT_ID, '12345');
  assert.equal(stored.EMAIL_FROM, 'from@example.com');
  assert.equal(stored.EMAIL_TO, 'to@example.com');
  assert.equal(stored.WEBHOOK_TEMPLATE, '{"text":"{{content}}"}');
});

test('invalid timezone is rejected', async () => {
  const env = createEnv({ config: JSON.stringify({ JWT_SECRET: 'secret' }) });
  const request = new Request('https://example.com/api/config', {
    method: 'POST',
    body: JSON.stringify({ TIMEZONE: 'Not/AZone' })
  });
  const response = await handleUpdateConfig(request, env);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
});

test('safe config does not expose password hash', async () => {
  const env = createEnv({
    config: JSON.stringify({
      JWT_SECRET: 'secret',
      ADMIN_PASSWORD_HASH: 'hash'
    })
  });
  const response = await handleGetConfig(env);
  const body = await response.json();

  assert.equal(Object.hasOwn(body, 'ADMIN_PASSWORD'), false);
  assert.equal(Object.hasOwn(body, 'ADMIN_PASSWORD_HASH'), false);
});
