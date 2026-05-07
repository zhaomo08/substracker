import { getConfig, setConfig } from '../../data/config.js';
import { generateRandomSecret, sanitizeNotificationHours } from '../utils.js';

// 这些字段可能包含 token/密钥，绝不下发到浏览器
const SECRET_FIELDS = [
  'TG_BOT_TOKEN',
  'NOTIFYX_API_KEY',
  'WEBHOOK_URL',
  'WEBHOOK_HEADERS',
  'WECHATBOT_WEBHOOK',
  'RESEND_API_KEY',
  'BARK_DEVICE_KEY',
  'THIRD_PARTY_API_TOKEN',
  'GOTIFY_APP_TOKEN',
  'SERVERCHAN_SENDKEY',
  'PUSHPLUS_TOKEN'
];

function isConfiguredSecret(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function buildSafeConfig(config) {
  const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = config;
  const response = { ...safeConfig };

  // 对每个敏感字段：返回空字符串 + 一个 *_CONFIGURED 标记
  SECRET_FIELDS.forEach((key) => {
    response[`${key}_CONFIGURED`] = isConfiguredSecret(safeConfig[key]);
    response[key] = '';
  });

  return response;
}

function normalizeClearSecretFields(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(item => typeof item === 'string' && item.trim().length > 0).map(item => item.trim());
  }
  if (typeof value === 'string') {
    return value.split(/[,，\s]+/).map(v => v.trim()).filter(Boolean);
  }
  return [];
}

function mergeSecretField(existingConfig, newConfig, key, clearSecretFields = []) {
  // 显式清空优先级最高
  if (clearSecretFields.includes(key)) return '';

  const incoming = newConfig?.[key];
  if (typeof incoming !== 'string') return existingConfig?.[key] || '';

  const trimmed = incoming.trim();

  // 兼容旧前端：曾用 "********" 作为占位符，表示不修改
  if (trimmed === '********') return existingConfig?.[key] || '';

  // 安全默认：空字符串不再代表清空（避免前端未回显导致误清空）
  if (!trimmed) return existingConfig?.[key] || '';

  return trimmed;
}

function hasOwnField(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function mergePlainField(existingConfig, newConfig, key, normalize) {
  if (!hasOwnField(newConfig, key)) return existingConfig?.[key];
  return normalize(newConfig[key], existingConfig?.[key]);
}

function mergeStringField(existingConfig, newConfig, key, options = {}) {
  const { trim = false, fallback = '' } = options;
  return mergePlainField(existingConfig, newConfig, key, (value, existingValue) => {
    const baseValue = existingValue !== undefined ? existingValue : fallback;
    if (value === undefined || value === null) return baseValue;
    const nextValue = typeof value === 'string' ? value : String(value);
    return trim ? nextValue.trim() : nextValue;
  });
}

async function handleGetConfig(env) {
  const config = await getConfig(env);
  return new Response(
    JSON.stringify(buildSafeConfig(config)),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateConfig(request, env) {
  try {
    const config = await getConfig(env);
    const newConfig = await request.json();
    const clearSecretFields = normalizeClearSecretFields(newConfig?.CLEAR_SECRET_FIELDS);

    const updatedConfig = {
      ...config,
      ADMIN_USERNAME: mergeStringField(config, newConfig, 'ADMIN_USERNAME', { trim: true, fallback: config.ADMIN_USERNAME || 'admin' }),
      THEME_MODE: mergePlainField(config, newConfig, 'THEME_MODE', (value, existingValue) => {
        const nextValue = typeof value === 'string' ? value.trim() : '';
        return nextValue || existingValue || 'system';
      }),

      TG_BOT_TOKEN: mergeSecretField(config, newConfig, 'TG_BOT_TOKEN', clearSecretFields),
      TG_CHAT_ID: mergeStringField(config, newConfig, 'TG_CHAT_ID', { trim: true, fallback: '' }),

      NOTIFYX_API_KEY: mergeSecretField(config, newConfig, 'NOTIFYX_API_KEY', clearSecretFields),

      WEBHOOK_URL: mergeSecretField(config, newConfig, 'WEBHOOK_URL', clearSecretFields),
      WEBHOOK_METHOD: mergePlainField(config, newConfig, 'WEBHOOK_METHOD', (value, existingValue) => {
        const nextValue = typeof value === 'string' ? value.trim() : '';
        return nextValue || existingValue || 'POST';
      }),
      WEBHOOK_HEADERS: mergeSecretField(config, newConfig, 'WEBHOOK_HEADERS', clearSecretFields),
      WEBHOOK_TEMPLATE: mergeStringField(config, newConfig, 'WEBHOOK_TEMPLATE', { fallback: '' }),

      SHOW_LUNAR: mergePlainField(config, newConfig, 'SHOW_LUNAR', value => value === true),

      WECHATBOT_WEBHOOK: mergeSecretField(config, newConfig, 'WECHATBOT_WEBHOOK', clearSecretFields),
      WECHATBOT_MSG_TYPE: mergePlainField(config, newConfig, 'WECHATBOT_MSG_TYPE', (value, existingValue) => {
        const nextValue = typeof value === 'string' ? value.trim() : '';
        return nextValue || existingValue || 'text';
      }),
      WECHATBOT_AT_MOBILES: mergeStringField(config, newConfig, 'WECHATBOT_AT_MOBILES', { trim: true, fallback: '' }),
      WECHATBOT_AT_ALL: mergeStringField(config, newConfig, 'WECHATBOT_AT_ALL', { trim: true, fallback: 'false' }),

      RESEND_API_KEY: mergeSecretField(config, newConfig, 'RESEND_API_KEY', clearSecretFields),
      EMAIL_FROM: mergeStringField(config, newConfig, 'EMAIL_FROM', { trim: true, fallback: '' }),
      EMAIL_FROM_NAME: mergeStringField(config, newConfig, 'EMAIL_FROM_NAME', { trim: true, fallback: '' }),
      EMAIL_TO: mergeStringField(config, newConfig, 'EMAIL_TO', { trim: true, fallback: '' }),

      BARK_DEVICE_KEY: mergeSecretField(config, newConfig, 'BARK_DEVICE_KEY', clearSecretFields),
      BARK_SERVER: mergePlainField(config, newConfig, 'BARK_SERVER', (value, existingValue) => {
        const nextValue = typeof value === 'string' ? value.trim() : '';
        return nextValue || existingValue || 'https://api.day.app';
      }),
      BARK_IS_ARCHIVE: mergeStringField(config, newConfig, 'BARK_IS_ARCHIVE', { trim: true, fallback: 'false' }),

      GOTIFY_SERVER_URL: mergeStringField(config, newConfig, 'GOTIFY_SERVER_URL', { trim: true, fallback: '' }),
      GOTIFY_APP_TOKEN: mergeSecretField(config, newConfig, 'GOTIFY_APP_TOKEN', clearSecretFields),

      SERVERCHAN_SENDKEY: mergeSecretField(config, newConfig, 'SERVERCHAN_SENDKEY', clearSecretFields),

      PUSHPLUS_TOKEN: mergeSecretField(config, newConfig, 'PUSHPLUS_TOKEN', clearSecretFields),
      PUSHPLUS_TOPIC: mergeStringField(config, newConfig, 'PUSHPLUS_TOPIC', { trim: true, fallback: '' }),
      PUSHPLUS_CHANNEL: mergeStringField(config, newConfig, 'PUSHPLUS_CHANNEL', { trim: true, fallback: '' }),

      ENABLED_NOTIFIERS: mergePlainField(config, newConfig, 'ENABLED_NOTIFIERS', (value, existingValue) => {
        return Array.isArray(value) ? value : (existingValue || ['notifyx']);
      }),
      TIMEZONE: mergePlainField(config, newConfig, 'TIMEZONE', (value, existingValue) => {
        const nextValue = typeof value === 'string' ? value.trim() : '';
        return nextValue || existingValue || 'UTC';
      }),

      THIRD_PARTY_API_TOKEN: mergeSecretField(config, newConfig, 'THIRD_PARTY_API_TOKEN', clearSecretFields),

      DEBUG_LOGS: mergePlainField(config, newConfig, 'DEBUG_LOGS', value => value === true),
      PAYMENT_HISTORY_LIMIT: Number.isFinite(Number(newConfig.PAYMENT_HISTORY_LIMIT))
        ? Math.min(1000, Math.max(10, Math.floor(Number(newConfig.PAYMENT_HISTORY_LIMIT))))
        : (config.PAYMENT_HISTORY_LIMIT || 100)
    };

    updatedConfig.NOTIFICATION_HOURS = hasOwnField(newConfig, 'NOTIFICATION_HOURS')
      ? sanitizeNotificationHours(newConfig.NOTIFICATION_HOURS)
      : (config.NOTIFICATION_HOURS || []);

    if (newConfig.ADMIN_PASSWORD) {
      updatedConfig.ADMIN_PASSWORD = newConfig.ADMIN_PASSWORD;
    }

    if (!updatedConfig.JWT_SECRET || updatedConfig.JWT_SECRET === 'your-secret-key') {
      updatedConfig.JWT_SECRET = generateRandomSecret();
      console.log('[安全] 生成新的JWT密钥');
    }

    await setConfig(env, updatedConfig);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('配置保存错误:', error);
    return new Response(
      JSON.stringify({ success: false, message: '更新配置失败: ' + error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { SECRET_FIELDS, handleGetConfig, handleUpdateConfig };
