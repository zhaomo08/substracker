import { maskValue, readSafeResponse } from './logging.js';

async function sendBarkNotification(title, content, config) {
  try {
    if (!config.BARK_DEVICE_KEY) {
      console.error('[Bark] 通知未配置，缺少设备Key');
      return false;
    }

    console.log('[Bark] 开始发送通知，设备:', maskValue(config.BARK_DEVICE_KEY));

    const serverUrl = config.BARK_SERVER || 'https://api.day.app';
    const url = serverUrl + '/push';
    const payload = {
      title: title,
      body: content,
      device_key: config.BARK_DEVICE_KEY
    };

    if (config.BARK_IS_ARCHIVE === 'true') {
      payload.isArchive = 1;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const result = await readSafeResponse(response);
    console.log('[Bark] 发送结果:', response.status);

    return result.code === 200;
  } catch (error) {
    console.error('[Bark] 发送通知失败:', error);
    return false;
  }
}

export { sendBarkNotification };
