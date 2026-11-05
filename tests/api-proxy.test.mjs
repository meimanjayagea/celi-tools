import test from 'node:test';
import assert from 'node:assert/strict';
import { executeProxyRequest, isPublicAddress, validateProxyRequest } from '../apps/web/app/lib/api-proxy.mjs';
import { parseCurl } from '../apps/web/app/lib/api-client.mjs';

test('server transport imports browser cURL headers and literal cookies', () => {
  const r = parseCurl("curl --url 'https://example.com/?q=1' -b 'session=test' -H 'referer: https://example.com/' -H 'sec-fetch-site: same-origin' -H 'user-agent: Example'", { server: true });
  assert.deepEqual(r.headers, [{ key:'Cookie',value:'session=test' },{key:'referer',value:'https://example.com/'},{key:'sec-fetch-site',value:'same-origin'},{key:'user-agent',value:'Example'}]);
  assert.throws(() => parseCurl('curl https://example.com -b cookies.txt', {server:true}), /file/i);
});

test('proxy rejects private, reserved and IPv6 destinations', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','100.64.0.1','192.168.1.1','172.16.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});

test('proxy validates input and rejects dangerous transport headers', () => {
  const request = {url:'https://example.com/',method:'GET',headers:[{key:'Cookie',value:'x=1'}],body:''};
  assert.equal(validateProxyRequest(request).headers.cookie, 'x=1');
  assert.throws(() => validateProxyRequest({...request,url:'http://127.0.0.1/'}), /publik/i);
  assert.throws(() => validateProxyRequest({...request,headers:[{key:'Host',value:'internal'}]}), /header/i);
  assert.throws(() => validateProxyRequest({...request,headers:[{key:'Transfer-Encoding',value:'chunked'}]}), /header/i);
  assert.throws(() => validateProxyRequest({...request,url:'https://u:p@example.com/'}), /URL/i);
});

test('proxy refuses localhost after DNS resolution before connecting', async () => {
  await assert.rejects(executeProxyRequest({url:'http://localhost/',method:'GET',headers:[],body:''}), /alamat publik/);
});

test('response classification preserves binary image and rejects SVG preview', async () => {
  const { classifyProxyBody } = await import('../apps/web/app/lib/api-proxy.mjs');
  const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
  const result = classifyProxyBody(png, 'image/png');
  assert.equal(result.previewType, 'image/png');
  assert.deepEqual(Buffer.from(result.base64, 'base64'), png);
  assert.equal(classifyProxyBody(Buffer.from('<svg/>'), 'image/svg+xml').previewType, null);
  assert.equal(classifyProxyBody(Buffer.from('{"ok":true}'), 'application/json').text, '{\n  "ok": true\n}');
  assert.equal(classifyProxyBody(Buffer.from('<script>'), 'image/png').previewType, null);
});

test('binary and multipart file requests preserve bytes and reject malformed uploads', () => {
  const input = { url:'https://example.com/', method:'POST', headers:[], body:'', file: { base64:Buffer.from([0,255,7]).toString('base64'), name:'test.png', contentType:'image/png', mode:'binary', fieldName:'file' } };
  const raw = validateProxyRequest(input);
  assert.deepEqual(raw.body, Buffer.from([0,255,7]));
  assert.equal(raw.headers['content-type'], 'image/png');
  const form = validateProxyRequest({...input,file:{...input.file, mode:'multipart'}});
  assert.match(form.headers['content-type'], /^multipart\/form-data; boundary=/);
  assert.ok(form.body.includes(Buffer.from([0,255,7])));
  assert.throws(() => validateProxyRequest({...input,file:{...input.file,base64:'@@@'}}), /file/i);
});

test('response headers preserve repeated values as separate rows', async () => {
  const { responseHeaderRows } = await import('../apps/web/app/lib/api-proxy.mjs');
  assert.deepEqual(responseHeaderRows(['Content-Type','image/png','Set-Cookie','a=1','Set-Cookie','b=2']), [
    {key:'Content-Type',value:'image/png'}, {key:'Set-Cookie',value:'a=1'}, {key:'Set-Cookie',value:'b=2'}
  ]);
});

test('HTTP header size includes the status/request line and CRLF framing', async () => {
  const { measureHttp1HeaderBytes, measureProxySizes } = await import('../apps/web/app/lib/api-proxy.mjs');
  assert.equal(measureHttp1HeaderBytes('HTTP/1.1 200 OK', ['Content-Type', 'application/json']), Buffer.byteLength('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n', 'latin1'));
  assert.equal(measureHttp1HeaderBytes('GET / HTTP/1.1', ['Host', 'example.com']), Buffer.byteLength('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n', 'latin1'));
  const sizes = measureProxySizes({ requestHeader:'POST / HTTP/1.1\r\nHost: example.com\r\n\r\n', requestBody:Buffer.from('é'), responseStartLine:'HTTP/1.1 200 OK', responseHeaders:['Content-Encoding','gzip'], responseBodyBytes:40, responseUncompressedBytes:100 });
  assert.deepEqual(sizes.request, { headersBytes:Buffer.byteLength('POST / HTTP/1.1\r\nHost: example.com\r\n\r\n'), bodyBytes:2, totalBytes:Buffer.byteLength('POST / HTTP/1.1\r\nHost: example.com\r\n\r\n')+2 });
  assert.deepEqual(sizes.response, { headersBytes:measureHttp1HeaderBytes('HTTP/1.1 200 OK', ['Content-Encoding','gzip']), bodyBytes:40, uncompressedBytes:100, totalBytes:measureHttp1HeaderBytes('HTTP/1.1 200 OK', ['Content-Encoding','gzip'])+40 });
});
