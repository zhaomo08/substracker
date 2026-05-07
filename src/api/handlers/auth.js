import { constantTimeEqual, generateJWT, hashPassword, verifyJWT, verifyPassword } from '../../core/auth.js';
import { getConfig, setConfig } from '../../data/config.js';
import { getCookieValue } from '../utils.js';

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_SECONDS = 15 * 60;

function getClientKey(request) {
  const ip = request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown';
  return `login_fail:${ip}`;
}

async function getLoginFailures(env, key) {
  const raw = await env.SUBSCRIPTIONS_KV.get(key);
  const data = raw ? JSON.parse(raw) : null;
  return data && Number.isFinite(data.count) ? data.count : 0;
}

async function recordLoginFailure(env, key) {
  const count = await getLoginFailures(env, key) + 1;
  await env.SUBSCRIPTIONS_KV.put(key, JSON.stringify({ count, updatedAt: new Date().toISOString() }), {
    expirationTtl: LOGIN_WINDOW_SECONDS
  });
  return count;
}

async function verifyAdminCredentials(env, config, username, password) {
  if (!constantTimeEqual(username || '', config.ADMIN_USERNAME || '')) {
    return false;
  }

  if (config.ADMIN_PASSWORD_HASH) {
    return verifyPassword(password || '', config.ADMIN_PASSWORD_HASH);
  }

  if (constantTimeEqual(password || '', config.ADMIN_PASSWORD || '')) {
    const passwordHash = await hashPassword(password || '');
    await setConfig(env, {
      ...config,
      ADMIN_PASSWORD: '',
      ADMIN_PASSWORD_HASH: passwordHash
    });
    return true;
  }

  return false;
}

async function handleLogin(request, env) {
  const config = await getConfig(env);
  const body = await request.json();
  const loginKey = getClientKey(request);
  const failureCount = await getLoginFailures(env, loginKey);

  if (failureCount >= LOGIN_LIMIT) {
    return new Response(
      JSON.stringify({ success: false, message: '登录失败次数过多，请稍后再试' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (await verifyAdminCredentials(env, config, body.username, body.password)) {
    const token = await generateJWT(body.username, config.JWT_SECRET);
    const secureCookie = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    await env.SUBSCRIPTIONS_KV.delete(loginKey);

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'token=' + token + '; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400' + secureCookie
        }
      }
    );
  }

  await recordLoginFailure(env, loginKey);

  return new Response(
    JSON.stringify({ success: false, message: '用户名或密码错误' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

function handleLogout() {
  return new Response('', {
    status: 302,
    headers: {
      'Location': '/',
      'Set-Cookie': 'token=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
    }
  });
}

async function getUserFromRequest(request, env) {
  const token = getCookieValue(request.headers.get('Cookie'), 'token');
  const config = await getConfig(env);
  const user = token ? await verifyJWT(token, config.JWT_SECRET) : null;
  return { user, config };
}

export { handleLogin, handleLogout, getUserFromRequest };
