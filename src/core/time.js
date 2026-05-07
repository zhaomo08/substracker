// 时间与时区工具
const MS_PER_HOUR = 1000 * 60 * 60;
const MS_PER_DAY = MS_PER_HOUR * 24;

function normalizeTimezone(timezone = 'UTC') {
  return isValidTimezone(timezone) ? timezone : 'UTC';
}

function getCurrentTimeInTimezone(timezone = 'UTC') {
  try {
    return convertUTCToTimezone(new Date(), timezone);
  } catch (error) {
    console.error(`时区转换错误: ${error.message}`);
    return new Date();
  }
}

function getTimestampInTimezone(timezone = 'UTC') {
  return getCurrentTimeInTimezone(timezone).getTime();
}

function convertUTCToTimezone(utcTime, timezone = 'UTC') {
  try {
    const date = new Date(utcTime);
    const safeTimezone = normalizeTimezone(timezone);
    const { year, month, day, hour, minute, second } = getTimezoneDateParts(date, safeTimezone);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, date.getUTCMilliseconds()));
  } catch (error) {
    console.error(`时区转换错误: ${error.message}`);
    return new Date(utcTime);
  }
}

function getTimezoneDateParts(date, timezone = 'UTC') {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const pick = (type) => {
      const part = parts.find(item => item.type === type);
      return part ? Number(part.value) : 0;
    };
    return {
      year: pick('year'),
      month: pick('month'),
      day: pick('day'),
      hour: pick('hour') === 24 ? 0 : pick('hour'),
      minute: pick('minute'),
      second: pick('second')
    };
  } catch (error) {
    console.error(`解析时区(${timezone})失败: ${error.message}`);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds()
    };
  }
}

function getTimezoneMidnightTimestamp(date, timezone = 'UTC') {
  const { year, month, day } = getTimezoneDateParts(date, normalizeTimezone(timezone));
  return Date.UTC(year, month - 1, day, 0, 0, 0);
}

function getDaysDiffInTimezone(targetDate, baseDate = new Date(), timezone = 'UTC') {
  const safeTimezone = normalizeTimezone(timezone);
  const targetMidnight = getTimezoneMidnightTimestamp(new Date(targetDate), safeTimezone);
  const baseMidnight = getTimezoneMidnightTimestamp(new Date(baseDate), safeTimezone);
  return Math.round((targetMidnight - baseMidnight) / MS_PER_DAY);
}

function formatTimeInTimezone(time, timezone = 'UTC', format = 'full') {
  try {
    const date = new Date(time);
    const safeTimezone = normalizeTimezone(timezone);

    if (format === 'date') {
      return date.toLocaleDateString('zh-CN', {
        timeZone: safeTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } else if (format === 'datetime') {
      return date.toLocaleString('zh-CN', {
        timeZone: safeTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } else {
      return date.toLocaleString('zh-CN', {
        timeZone: safeTimezone
      });
    }
  } catch (error) {
    console.error(`时间格式化错误: ${error.message}`);
    return new Date(time).toISOString();
  }
}

function getTimezoneOffset(timezone = 'UTC') {
  try {
    const now = new Date();
    const { year, month, day, hour, minute, second } = getTimezoneDateParts(now, normalizeTimezone(timezone));
    const zonedTimestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    return Math.round((zonedTimestamp - now.getTime()) / MS_PER_HOUR);
  } catch (error) {
    console.error(`获取时区偏移量错误: ${error.message}`);
    return 0;
  }
}

function formatTimezoneDisplay(timezone = 'UTC') {
  try {
    const offset = getTimezoneOffset(timezone);
    const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;

    const timezoneNames = {
      'UTC': '世界标准时间',
      'Asia/Shanghai': '中国标准时间',
      'Asia/Hong_Kong': '香港时间',
      'Asia/Taipei': '台北时间',
      'Asia/Singapore': '新加坡时间',
      'Asia/Tokyo': '日本时间',
      'Asia/Seoul': '韩国时间',
      'America/New_York': '美国东部时间',
      'America/Los_Angeles': '美国太平洋时间',
      'America/Chicago': '美国中部时间',
      'America/Denver': '美国山地时间',
      'Europe/London': '英国时间',
      'Europe/Paris': '巴黎时间',
      'Europe/Berlin': '柏林时间',
      'Europe/Moscow': '莫斯科时间',
      'Australia/Sydney': '悉尼时间',
      'Australia/Melbourne': '墨尔本时间',
      'Pacific/Auckland': '奥克兰时间'
    };

    const timezoneName = timezoneNames[timezone] || timezone;
    return `${timezoneName} (UTC${offsetStr})`;
  } catch (error) {
    console.error('格式化时区显示失败:', error);
    return timezone;
  }
}

function formatBeijingTime(date = new Date(), format = 'full') {
  return formatTimeInTimezone(date, 'Asia/Shanghai', format);
}

function extractTimezone(request) {
  const url = new URL(request.url);
  const timezoneParam = url.searchParams.get('timezone');

  if (timezoneParam) return timezoneParam;

  const timezoneHeader = request.headers.get('X-Timezone');
  if (timezoneHeader) return timezoneHeader;

  const acceptLanguage = request.headers.get('Accept-Language');
  if (acceptLanguage) {
    if (acceptLanguage.includes('zh')) return 'Asia/Shanghai';
    if (acceptLanguage.includes('en-US')) return 'America/New_York';
    if (acceptLanguage.includes('en-GB')) return 'Europe/London';
  }

  return 'UTC';
}

function isValidTimezone(timezone) {
  try {
    new Date().toLocaleString('en-US', { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

export {
  MS_PER_HOUR,
  MS_PER_DAY,
  normalizeTimezone,
  getCurrentTimeInTimezone,
  getTimestampInTimezone,
  convertUTCToTimezone,
  getTimezoneDateParts,
  getTimezoneMidnightTimestamp,
  getDaysDiffInTimezone,
  formatTimeInTimezone,
  getTimezoneOffset,
  formatTimezoneDisplay,
  formatBeijingTime,
  extractTimezone,
  isValidTimezone
};
