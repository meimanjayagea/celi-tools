import { lookup } from 'node:dns/promises';
import { isIP, BlockList } from 'node:net';
import { request as httpRequest, validateHeaderName, validateHeaderValue } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { randomBytes } from 'node:crypto';

const deny = new BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]]) deny.addSubnet(address, prefix, 'ipv4');
const blockedHeaders = new Set(['host','content-length','connection','transfer-encoding','upgrade','proxy-authorization','proxy-connection','keep-alive','te','trailer','expect']);
const methods = new Set(['GET','POST','PUT','PATCH','DELETE']);
export function isPublicAddress(address) { return isIP(address) === 4 && !deny.check(address, 'ipv4'); }

export function responseHeaderRows(rawHeaders) {
  const rows = [];
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) rows.push({ key: rawHeaders[index], value: rawHeaders[index + 1] });
  return rows;
}

/** Count the HTTP/1 start line, header lines, and final CRLF in bytes. */
export function measureHttp1HeaderBytes(startLine, rawHeaders) {
  let text = `${startLine}\r\n`;
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) text += `${rawHeaders[index]}: ${rawHeaders[index + 1]}\r\n`;
  return Buffer.byteLength(`${text}\r\n`, 'latin1');
}

export function measureProxySizes({ requestHeader, requestBody, responseStartLine, responseHeaders, responseBodyBytes, responseUncompressedBytes }) {
  const requestHeadersBytes = Buffer.byteLength(requestHeader, 'latin1');
  const requestBodyBytes = Buffer.isBuffer(requestBody) ? requestBody.byteLength : Buffer.byteLength(requestBody || '');
  const responseHeadersBytes = measureHttp1HeaderBytes(responseStartLine, responseHeaders);
  return {
    request: { headersBytes: requestHeadersBytes, bodyBytes: requestBodyBytes, totalBytes: requestHeadersBytes + requestBodyBytes },
    response: { headersBytes: responseHeadersBytes, bodyBytes: responseBodyBytes, uncompressedBytes: responseUncompressedBytes, totalBytes: responseHeadersBytes + responseBodyBytes },
  };
}

export function classifyProxyBody(buffer, contentType) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const signatures = {
    'image/png': buffer.length >= 8 && buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),
    'image/jpeg': buffer.length >= 3 && buffer.subarray(0,3).equals(Buffer.from('ffd8ff','hex')),
    'image/gif': buffer.subarray(0,6).toString('ascii') === 'GIF87a' || buffer.subarray(0,6).toString('ascii') === 'GIF89a',
    'image/webp': buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP',
  };
  const previewType = signatures[mime] ? mime : null;
  const isText = mime.startsWith('text/') || /(?:json|xml|javascript|x-www-form-urlencoded)$/.test(mime) || !mime;
  let text = isText ? buffer.toString('utf8') : '';
  if (text) try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* Preserve textual responses. */ }
  return { text, base64: buffer.toString('base64'), contentType: mime || 'application/octet-stream', previewType };
}

export function validateProxyRequest(input) {
  if (!input || typeof input !== 'object' || typeof input.url !== 'string' || input.url.length > 8192) throw new Error('URL tidak valid.');
  let url; try { url = new URL(input.url); } catch { throw new Error('URL tidak valid.'); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error('URL harus menggunakan HTTP atau HTTPS tanpa kredensial.');
  if (isIP(url.hostname.replace(/^\[|\]$/g,'')) && !isPublicAddress(url.hostname)) throw new Error('Hanya alamat publik yang diizinkan.');
  if (!methods.has(input.method) || !Array.isArray(input.headers) || input.headers.length > 100 || typeof input.body !== 'string' || Buffer.byteLength(input.body) > 1024*1024) throw new Error('Request tidak valid atau terlalu besar.');
  const headers = Object.create(null); let total = 0;
  for (const row of input.headers) {
    if (!row || typeof row.key !== 'string' || typeof row.value !== 'string') throw new Error('Header tidak valid.');
    const key = row.key.trim().toLowerCase(); if (!key && !row.value) continue;
    if (!key || blockedHeaders.has(key) || key.startsWith('proxy-')) throw new Error('Header transport tidak diizinkan.');
    try { validateHeaderName(key); validateHeaderValue(key, row.value); } catch { throw new Error('Header tidak valid.'); }
    total += Buffer.byteLength(key) + Buffer.byteLength(row.value);
    if (total > 65536) throw new Error('Header terlalu besar.');
    headers[key] = headers[key] ? headers[key] + (key === 'cookie' ? '; ' : ', ') + row.value : row.value;
  }
  let body = input.body;
  if (input.file != null) {
    const file = input.file;
    if (!file || typeof file.base64 !== 'string' || file.base64.length > 700_000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw new Error('File tidak valid.');
    const bytes = Buffer.from(file.base64, 'base64');
    if (!bytes.length || bytes.length > 512*1024 || bytes.toString('base64') !== file.base64 || !['binary','multipart'].includes(file.mode) || !['POST','PUT','PATCH'].includes(input.method)) throw new Error('File tidak valid atau terlalu besar.');
    if (typeof file.name !== 'string' || typeof file.contentType !== 'string' || typeof file.fieldName !== 'string' || input.body) throw new Error('File tidak valid.');
    const name = file.name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'file';
    const field = file.fieldName.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'file';
    const type = /^[\w.+-]+\/[\w.+-]+$/.test(file.contentType) ? file.contentType : 'application/octet-stream';
    if (file.mode === 'binary') { body = bytes; headers['content-type'] = type; }
    else {
      const boundary = 'celimanapp-' + randomBytes(16).toString('hex');
      headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
      body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n`), bytes, Buffer.from(`\r\n--${boundary}--\r\n`)]);
    }
  }
  if (typeof body === 'string' && body.trim() && !headers['content-type']) {
    try { JSON.parse(input.body); headers['content-type'] = 'application/json'; } catch { /* Preserve raw body without assuming a content type. */ }
  }
  if (body.length) headers['content-length'] = String(Buffer.byteLength(body));
  return { url, method: input.method, headers, body };
}

/** DNS is resolved once and the approved address is pinned to the actual connection. */
export async function executeProxyRequest(input, signal) {
  const request = validateProxyRequest(input);
  const start = performance.now();
  let addresses;
  let dnsTimer;
  try { addresses = await Promise.race([lookup(request.url.hostname, { all:true, family:4 }), new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error('DNS timeout')), 5000); })]); }
  catch { throw new Error('Domain tidak dapat ditemukan.'); }
  finally { clearTimeout(dnsTimer); }
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error('Hanya alamat publik yang diizinkan.');
  const address = addresses[0].address;
  return new Promise((resolve, reject) => {
    const send = request.url.protocol === 'https:' ? httpsRequest : httpRequest;
    const outgoing = send(request.url, { method:request.method, headers:request.headers, agent:false, family:4, signal, lookup: (_host, _options, cb) => cb(null, address, 4) }, response => {
      const encoding = String(response.headers['content-encoding'] || '').toLowerCase();
      const decompressor = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() : encoding === 'br' ? createBrotliDecompress() : null;
      if (encoding && encoding !== 'identity' && !decompressor) { response.destroy(); reject(new Error('Encoding respons tidak didukung.')); return; }
      const stream = decompressor ? response.pipe(decompressor) : response;
      const chunks = []; let bytes = 0, responseBodyBytes = 0, truncated = false, settled = false;
      const finish = () => {
        if (settled) return; settled = true;
        const body = classifyProxyBody(Buffer.concat(chunks), response.headers['content-type']);
        const metrics = measureProxySizes({ requestHeader: outgoing._header || '', requestBody: request.body, responseStartLine: `HTTP/${response.httpVersion} ${response.statusCode || 0} ${response.statusMessage || ''}`.trimEnd(), responseHeaders: response.rawHeaders, responseBodyBytes, responseUncompressedBytes: bytes });
        resolve({ status:response.statusCode || 0, statusText:response.statusMessage || '', milliseconds:Math.round(performance.now()-start), bytes, headers:responseHeaderRows(response.rawHeaders), metrics, ...body, truncated });
      };
      response.on('data', chunk => { responseBodyBytes += chunk.length; });
      stream.on('data', chunk => { const remaining = 2*1024*1024 - bytes; if (chunk.length > remaining) { chunks.push(chunk.subarray(0, remaining)); bytes += remaining; truncated = true; stream.destroy(); response.destroy(); finish(); } else { chunks.push(chunk); bytes += chunk.length; } });
      stream.on('end', finish); stream.on('error', () => { if (!settled) reject(new Error('Respons tidak dapat dibaca.')); });
      response.on('error', () => { if (!settled) reject(new Error('Respons tidak dapat dibaca.')); });
    });
    outgoing.setTimeout(15000, () => outgoing.destroy(new Error('timeout')));
    outgoing.on('error', () => reject(new Error('API tidak dapat dijangkau atau melewati batas waktu.')));
    if (request.body) outgoing.write(request.body);
    outgoing.end();
  });
}
