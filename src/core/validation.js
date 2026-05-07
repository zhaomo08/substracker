import { isValidTimezone } from './time.js';

const PERIOD_UNITS = new Set(['day', 'month', 'year']);
const SUBSCRIPTION_MODES = new Set(['cycle', 'reset']);
const REMINDER_UNITS = new Set(['day', 'hour']);
const CURRENCIES = new Set(['CNY', 'USD', 'HKD', 'TWD', 'JPY', 'EUR', 'GBP', 'KRW', 'TRY']);
const NOTIFIERS = new Set(['notifyx', 'telegram', 'webhook', 'wechatbot', 'email', 'bark', 'gotify', 'serverchan', 'pushplus']);

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function parsePositiveInteger(value, field, options = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 10000;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    return { success: false, message: `${field} 必须是 ${min}-${max} 的整数` };
  }
  return { success: true, value: number };
}

function parseOptionalAmount(value) {
  if (value === undefined || value === null || value === '') {
    return { success: true, value: null };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return { success: false, message: '金额必须是大于或等于 0 的数字' };
  }
  return { success: true, value: number };
}

function parseDate(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    return { success: false, message: `${field} 必须是有效日期` };
  }
  return { success: true, value: date };
}

function validateSubscriptionInput(input = {}, options = {}) {
  const requireName = options.requireName !== false;
  const subscription = { ...input };

  if (requireName && (!subscription.name || !String(subscription.name).trim())) {
    return { success: false, message: '订阅名称不能为空' };
  }
  if (subscription.name !== undefined) subscription.name = String(subscription.name).trim();

  const expiryResult = parseDate(subscription.expiryDate, '到期日期');
  if (!expiryResult.success) return expiryResult;
  subscription.expiryDate = expiryResult.value.toISOString();

  if (subscription.startDate) {
    const startResult = parseDate(subscription.startDate, '开始日期');
    if (!startResult.success) return startResult;
    subscription.startDate = startResult.value.toISOString();
  }

  const periodValue = parsePositiveInteger(subscription.periodValue ?? 1, '订阅周期');
  if (!periodValue.success) return periodValue;
  subscription.periodValue = periodValue.value;

  subscription.periodUnit = subscription.periodUnit || 'month';
  if (!PERIOD_UNITS.has(subscription.periodUnit)) {
    return { success: false, message: '订阅周期单位无效' };
  }

  subscription.subscriptionMode = subscription.subscriptionMode || 'cycle';
  if (!SUBSCRIPTION_MODES.has(subscription.subscriptionMode)) {
    return { success: false, message: '续订模式无效' };
  }

  if (subscription.reminderUnit !== undefined && !REMINDER_UNITS.has(subscription.reminderUnit)) {
    return { success: false, message: '提醒单位无效' };
  }
  const reminderValue = subscription.reminderValue ?? subscription.reminderDays ?? subscription.reminderHours;
  if (reminderValue !== undefined && reminderValue !== null && reminderValue !== '') {
    const parsedReminder = parsePositiveInteger(reminderValue, '提醒时间', { min: 0, max: 10000 });
    if (!parsedReminder.success) return parsedReminder;
    subscription.reminderValue = parsedReminder.value;
  }

  const amountResult = parseOptionalAmount(subscription.amount);
  if (!amountResult.success) return amountResult;
  subscription.amount = amountResult.value;

  subscription.currency = subscription.currency || 'CNY';
  if (!CURRENCIES.has(subscription.currency)) {
    return { success: false, message: '币种无效' };
  }

  return { success: true, subscription };
}

function validateRenewOptions(options = {}) {
  const normalized = { ...options };

  if (normalized.paymentDate) {
    const paymentResult = parseDate(normalized.paymentDate, '付款日期');
    if (!paymentResult.success) return paymentResult;
    normalized.paymentDate = paymentResult.value.toISOString();
  }

  if (normalized.amount !== undefined) {
    const amountResult = parseOptionalAmount(normalized.amount);
    if (!amountResult.success) return amountResult;
    normalized.amount = amountResult.value ?? 0;
  }

  const multiplierResult = parsePositiveInteger(normalized.periodMultiplier ?? 1, '续订周期数', { min: 1, max: 120 });
  if (!multiplierResult.success) return multiplierResult;
  normalized.periodMultiplier = multiplierResult.value;

  return { success: true, options: normalized };
}

function validateConfigPatch(input = {}) {
  if (Object.prototype.hasOwnProperty.call(input, 'TIMEZONE') && input.TIMEZONE && !isValidTimezone(input.TIMEZONE)) {
    return { success: false, message: '时区无效' };
  }

  if (Object.prototype.hasOwnProperty.call(input, 'PAYMENT_HISTORY_LIMIT')) {
    const limit = Number(input.PAYMENT_HISTORY_LIMIT);
    if (!Number.isFinite(limit) || limit < 10 || limit > 1000) {
      return { success: false, message: '支付历史上限必须在 10-1000 之间' };
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'ENABLED_NOTIFIERS')) {
    if (!Array.isArray(input.ENABLED_NOTIFIERS)) {
      return { success: false, message: '通知渠道必须是数组' };
    }
    const invalid = input.ENABLED_NOTIFIERS.find(item => !NOTIFIERS.has(item));
    if (invalid) {
      return { success: false, message: `通知渠道无效: ${invalid}` };
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'WEBHOOK_METHOD')) {
    const method = String(input.WEBHOOK_METHOD || '').toUpperCase();
    if (method && !['GET', 'POST', 'PUT', 'PATCH'].includes(method)) {
      return { success: false, message: 'Webhook 请求方法无效' };
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, 'NOTIFICATION_HOURS')) {
    const raw = Array.isArray(input.NOTIFICATION_HOURS) ? input.NOTIFICATION_HOURS : String(input.NOTIFICATION_HOURS || '').split(/[,，\s]+/);
    for (const item of raw) {
      const value = String(item).trim();
      if (!value || value === '*' || value.toUpperCase() === 'ALL') continue;
      if (!isFiniteNumber(value) || Number(value) < 0 || Number(value) > 23) {
        return { success: false, message: '通知小时必须在 0-23 之间' };
      }
    }
  }

  return { success: true };
}

export {
  CURRENCIES,
  NOTIFIERS,
  PERIOD_UNITS,
  validateConfigPatch,
  validateRenewOptions,
  validateSubscriptionInput
};
