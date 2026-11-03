import test from 'node:test';
import assert from 'node:assert/strict';
import { runRace, validateRaceOptions } from '../apps/web/app/lib/api-race.mjs';

test('validates count and schedule bounds', () => {
  assert.equal(validateRaceOptions({count:1000, schedule:'', now:1000}).count,1000);
  for (const count of [0,1001,2.5,NaN]) assert.throws(() => validateRaceOptions({count,schedule:'',now:1000}));
  assert.throws(() => validateRaceOptions({count:1,schedule:'1970-01-01T00:00',now:1000}));
});

test('launches requests concurrently and counts HTTP and network errors', async () => {
  let active=0, peak=0, calls=0;
  const fetcher=async () => { const n=++calls; peak=Math.max(peak,++active); await new Promise(r=>setTimeout(r,5)); active--; if(n===3) throw new Error('network'); return {status:n===2?409:200,body:{cancel:async()=>{}}}; };
  const result=await runRace({url:'https://example.com',method:'POST',headers:new Headers(),body:'{}'}, {count:5, fetcher, timeoutMs:1000});
  assert.equal(peak,5); assert.equal(result.completed,5); assert.equal(result.statuses['200'],3); assert.equal(result.statuses['409'],1); assert.equal(result.networkErrors,1);
});

test('caps request count and cancellation reports aborted requests', async () => {
  await assert.rejects(runRace({url:'https://example.com'}, {count:1001}), /1000/);
  const controller=new AbortController();
  const fetcher=(_url,{signal}) => new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')), {once:true}));
  const pending=runRace({url:'https://example.com',method:'GET'}, {count:8,fetcher,signal:controller.signal,timeoutMs:1000});
  controller.abort(); const result=await pending;
  assert.equal(result.canceled,true); assert.equal(result.aborted,8); assert.equal(result.completed,8);
});

test('executes 1000 real requests against a local test server', async () => {
  const { createServer } = await import('node:http');
  let hits=0;
  const server=createServer((_req,res)=>{ hits++; res.writeHead(204); res.end(); });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const result=await runRace({url:`http://127.0.0.1:${server.address().port}/`,method:'GET',headers:new Headers()}, {count:1000,timeoutMs:30000});
    assert.ok(hits > 0); assert.equal(result.statuses['204'], hits); assert.equal(result.completed, 1000); assert.equal((result.statuses['204'] || 0) + result.networkErrors + result.aborted, 1000);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('dispatches all 1000 operations before any completes', async () => {
  let started=0; let release; const gate=new Promise(resolve=>{release=resolve;});
  const pending=runRace({url:'https://example.com',method:'GET',headers:new Headers()}, {count:1000,timeoutMs:5000,fetcher:async()=>{started++; await gate; return {status:200,body:null};}});
  assert.equal(started,1000); release();
  const result=await pending; assert.equal(result.statuses['200'],1000);
});
