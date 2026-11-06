import test from "node:test";
import assert from "node:assert/strict";
import { classifyProviderFailure, streamWithFallback } from "../apps/web/app/lib/ai-agent/failover-policy.mjs";
import { uiStreamWithFallback } from "../apps/web/app/lib/ai-agent/ui-stream.mjs";
import { createUIMessageStream, uiMessageChunkSchema } from "ai";

async function collect(iterable) {
  const result=[];
  for await (const item of iterable) result.push(item);
  return result;
}

test("recognizes provider quota codes and transient HTTP/network failures", () => {
  assert.deepEqual(classifyProviderFailure({ status:429 }), { retryable:true, category:"rate_limit" });
  assert.deepEqual(classifyProviderFailure({ status:403, responseBody:JSON.stringify({ error:{ code:"insufficient_quota" } }) }), { retryable:true, category:"quota_or_rate_limit" });
  assert.deepEqual(classifyProviderFailure({ status:503 }), { retryable:true, category:"provider_unavailable" });
  assert.deepEqual(classifyProviderFailure(Object.assign(new Error("socket reset"), { code:"ECONNRESET" })), { retryable:true, category:"network" });
  assert.deepEqual(classifyProviderFailure(Object.assign(new Error("header timeout"), { code:"UND_ERR_HEADERS_TIMEOUT" })), { retryable:true, category:"network" });
  assert.deepEqual(classifyProviderFailure(Object.assign(new Error("provider timeout"), { name:"TimeoutError" })), { retryable:true, category:"network" });
});

test("does not retry invalid credentials or client errors", () => {
  assert.equal(classifyProviderFailure({ status:401 }).retryable,false);
  assert.equal(classifyProviderFailure({ status:400, message:"model not found" }).retryable,false);
  assert.equal(classifyProviderFailure(Object.assign(new Error("aborted"), { name:"AbortError" })).retryable,false);
});

test("falls back in order after a retryable failure before any text", async () => {
  const calls=[];
  const profiles=[{id:"primary"},{id:"fallback"}];
  const output=await collect(streamWithFallback({ profiles, createStream:async(profile)=>{
    calls.push(profile.id);
    if (profile.id==="primary") return (async function*(){ throw { status:429 }; })();
    return (async function*(){ yield "ok"; })();
  } }));
  assert.deepEqual(calls,["primary","fallback"]);
  assert.deepEqual(output,["ok"]);
});

test("does not restart after text starts, and abort stops later profiles", async () => {
  const calls=[];
  const stream=streamWithFallback({ profiles:[{id:"primary"},{id:"fallback"}], createStream:async(profile)=>{
    calls.push(profile.id);
    return (async function*(){ yield "partial"; throw { status:503 }; })();
  } });
  const iterator=stream[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value,"partial");
  await assert.rejects(iterator.next());
  assert.deepEqual(calls,["primary"]);

  const controller=new AbortController();
  controller.abort();
  await assert.rejects(collect(streamWithFallback({ profiles:[{id:"primary"}], signal:controller.signal, createStream:async()=>{ throw new Error("should not start"); } })));
});

test("caps the provider chain at four attempts", async () => {
  const calls=[];
  await assert.rejects(collect(streamWithFallback({profiles:Array.from({length:7},(_,i)=>({id:String(i)})),createStream:async(profile)=>{
    calls.push(profile.id);
    return (async function*(){throw {status:429};})();
  }})));
  assert.deepEqual(calls,["0","1","2","3"]);
});

test("emits one valid UI stream after pre-text fallback and does not restart after visible text", async () => {
  const chunks=[];const calls=[];
  const writer={write:chunk=>chunks.push(chunk)};
  await uiStreamWithFallback({writer,profiles:[{id:"first"},{id:"second"}],createStream:async(profile)=>{
    calls.push(profile.id);
    if(profile.id==="first")return(async function*(){yield "";throw {status:429};})();
    return(async function*(){yield "answer";})();
  },createId:(()=>{let id=0;return()=>`id-${++id}`;})()});
  assert.deepEqual(calls,["first","second"]);
  assert.deepEqual(chunks.map(chunk=>chunk.type),["start","start-step","text-start","text-delta","text-end","finish-step","finish"]);
  assert.equal(chunks.filter(chunk=>chunk.type==="start").length,1);
  for(const chunk of chunks)assert.equal((await uiMessageChunkSchema().validate(chunk)).success,true);

  const afterText=[];const providerCalls=[];
  await uiStreamWithFallback({writer:{write:chunk=>afterText.push(chunk)},profiles:[{id:"first"},{id:"second"}],createStream:async(profile)=>{
    providerCalls.push(profile.id);
    return(async function*(){yield "partial";throw {status:503};})();
  },createId:(()=>{let id=0;return()=>`post-${++id}`;})()});
  assert.deepEqual(providerCalls,["first"]);
  assert.deepEqual(afterText.map(chunk=>chunk.type),["start","start-step","text-start","text-delta","error","text-end","finish-step","finish"]);
  for(const chunk of afterText)assert.equal((await uiMessageChunkSchema().validate(chunk)).success,true);
});

test("composes the fallback events through the real AI SDK UI message stream", async () => {
  const stream=createUIMessageStream({execute:({writer})=>uiStreamWithFallback({
    writer,
    profiles:[{id:"primary"}],
    createStream:async()=> (async function*(){yield "hello";})(),
    createId:(()=>{let id=0;return()=>`sdk-${++id}`;})(),
  })});
  const chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  assert.deepEqual(chunks.map(chunk=>chunk.type),["start","start-step","text-start","text-delta","text-end","finish-step","finish"]);
  for(const chunk of chunks)assert.equal((await uiMessageChunkSchema().validate(chunk)).success,true);
});
