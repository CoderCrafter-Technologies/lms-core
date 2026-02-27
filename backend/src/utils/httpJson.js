const https = require('https');
const http = require('http');

const requestJson = ({ method = 'GET', url, headers = {}, body = null, timeoutMs = 20000 }) =>
  new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.request(
        parsedUrl,
        {
          method,
          headers,
          timeout: timeoutMs
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            let data = null;
            try {
              data = raw ? JSON.parse(raw) : null;
            } catch {
              data = raw;
            }
            resolve({
              ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
              status: res.statusCode || 500,
              data
            });
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy(new Error('Request timeout'));
      });
      if (body) req.write(body);
      req.end();
    } catch (error) {
      reject(error);
    }
  });

const postJson = async (url, payload, headers = {}) => {
  const body = JSON.stringify(payload);
  return requestJson({
    method: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      ...headers
    },
    body
  });
};

module.exports = {
  requestJson,
  postJson
};
