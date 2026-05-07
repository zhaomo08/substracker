const CryptoJS = {
  HmacSHA256: function(message, key) {
    const keyData = new TextEncoder().encode(key);
    const messageData = new TextEncoder().encode(message);

    return Promise.resolve().then(() => {
      return crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: {name: "SHA-256"} },
        false,
        ["sign"]
      );
    }).then(cryptoKey => {
      return crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        messageData
      );
    }).then(buffer => {
      const hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    });
  }
};

const PASSWORD_HASH_ITERATIONS = 120000;

function bytesToHex(bytes) {
  return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function randomHex(byteLength = 16) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

function constantTimeEqual(a = '', b = '') {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let i = 0; i < length; i++) {
    diff |= (left[i] || 0) ^ (right[i] || 0);
  }

  return diff === 0;
}

async function pbkdf2Hex(password, saltHex, iterations = PASSWORD_HASH_ITERATIONS) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(password)),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(saltHex),
      iterations
    },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

async function hashPassword(password) {
  const salt = randomHex(16);
  const hash = await pbkdf2Hex(password, salt);
  return `pbkdf2-sha256$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

async function verifyPassword(password, encodedHash) {
  if (!encodedHash || typeof encodedHash !== 'string') return false;
  const [algorithm, iterationsRaw, salt, expectedHash] = encodedHash.split('$');
  const iterations = Number(iterationsRaw);

  if (algorithm !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || !salt || !expectedHash) {
    return false;
  }

  const actualHash = await pbkdf2Hex(password, salt, iterations);
  return constantTimeEqual(actualHash, expectedHash);
}

function base64UrlEncode(value) {
  return btoa(JSON.stringify(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + (4 - normalized.length % 4) % 4, '=');
  return JSON.parse(atob(padded));
}

async function generateJWT(username, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    username,
    iat: now,
    exp: now + 86400
  };

  const base64Header = base64UrlEncode(header);
  const base64Payload = base64UrlEncode(payload);
  const signatureInput = base64Header + '.' + base64Payload;
  const signature = await CryptoJS.HmacSHA256(signatureInput, secret);

  return signatureInput + '.' + signature;
}

async function verifyJWT(token, secret) {
  try {
    if (!token || !secret) {
      console.log('[JWT] Token或Secret为空');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('[JWT] Token格式错误，部分数量:', parts.length);
      return null;
    }

    const [headerBase64, payloadBase64, signature] = parts;
    const signatureInput = headerBase64 + '.' + payloadBase64;
    const expectedSignature = await CryptoJS.HmacSHA256(signatureInput, secret);

    if (!constantTimeEqual(signature, expectedSignature)) {
      console.log('[JWT] 签名验证失败');
      return null;
    }

    const payload = base64UrlDecode(payloadBase64);
    const now = Math.floor(Date.now() / 1000);

    if (!Number.isFinite(payload.exp) || payload.exp <= now) {
      console.log('[JWT] Token已过期或缺少有效exp');
      return null;
    }

    console.log('[JWT] 验证成功，用户:', payload.username);
    return payload;
  } catch (error) {
    console.error('[JWT] 验证过程出错:', error);
    return null;
  }
}

export { constantTimeEqual, generateJWT, hashPassword, verifyJWT, verifyPassword };
