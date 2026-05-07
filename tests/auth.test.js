import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLogin } from '../src/api/handlers/auth.js';
import { createEnv } from './helpers.js';

test('login migrates legacy plaintext password to hash and sets secure cookie on https', async () => {
  const env = createEnv({
    config: JSON.stringify({
      JWT_SECRET: 'secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password'
    })
  });
  const request = new Request('https://example.com/api/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '127.0.0.1' },
    body: JSON.stringify({ username: 'admin', password: 'password' })
  });

  const response = await handleLogin(request, env);
  const stored = JSON.parse(await env.SUBSCRIPTIONS_KV.get('config'));

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Set-Cookie'), /Secure/);
  assert.equal(stored.ADMIN_PASSWORD, '');
  assert.match(stored.ADMIN_PASSWORD_HASH, /^sha256\$/);
});

test('login returns 429 after repeated failures', async () => {
  const env = createEnv({
    config: JSON.stringify({
      JWT_SECRET: 'secret',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'password'
    })
  });

  for (let i = 0; i < 5; i++) {
    await handleLogin(new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '192.0.2.1' },
      body: JSON.stringify({ username: 'admin', password: 'wrong' })
    }), env);
  }

  const response = await handleLogin(new Request('https://example.com/api/login', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ username: 'admin', password: 'wrong' })
  }), env);

  assert.equal(response.status, 429);
});
