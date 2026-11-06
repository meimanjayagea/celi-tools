import test from "node:test";
import assert from "node:assert/strict";
import { generateText } from "ai";
import { createProviderChatModel } from "../apps/web/app/lib/ai-agent/provider-model.mjs";

const cases=[
  {provider:"openai",baseURL:"https://api.openai.com/v1",path:"/v1/responses",auth:"Bearer test-key",kind:"openai-responses"},
  {provider:"anthropic",baseURL:"https://api.anthropic.com/v1",path:"/v1/messages",auth:"x-api-key:test-key",kind:"anthropic"},
  {provider:"google",baseURL:"https://generativelanguage.googleapis.com/v1beta",path:"/v1beta/models/test-model:generateContent",auth:"x-goog-api-key:test-key",kind:"google"},
  {provider:"groq",baseURL:"https://api.groq.com/openai/v1",path:"/openai/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
  {provider:"xai",baseURL:"https://api.x.ai/v1",path:"/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
  {provider:"openrouter",baseURL:"https://openrouter.ai/api/v1",path:"/api/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
  {provider:"opencode-zen",baseURL:"https://opencode.ai/zen/v1",path:"/zen/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
  {provider:"hermes",baseURL:"https://hermes.example/v1",path:"/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
  {provider:"openai-compatible",baseURL:"https://custom.example/api/v1",path:"/api/v1/chat/completions",auth:"Bearer test-key",kind:"openai"},
];

function responseFor(kind) {
  if(kind==="anthropic")return {id:"msg_test",type:"message",role:"assistant",content:[{type:"text",text:"adapter-ok"}],model:"test-model",stop_reason:"end_turn",stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};
  if(kind==="google")return {candidates:[{content:{parts:[{text:"adapter-ok"}],role:"model"},finishReason:"STOP"}],usageMetadata:{promptTokenCount:1,candidatesTokenCount:1,totalTokenCount:2},modelVersion:"test-model"};
  if(kind==="openai-responses")return {id:"resp_test",created_at:1,model:"test-model",output:[{type:"message",role:"assistant",id:"msg_test",content:[{type:"output_text",text:"adapter-ok",annotations:[]}]}],usage:{input_tokens:1,input_tokens_details:{cached_tokens:0},output_tokens:1,output_tokens_details:{reasoning_tokens:0},total_tokens:2}};
  return {id:"chatcmpl_test",object:"chat.completion",created:1,model:"test-model",choices:[{index:0,message:{role:"assistant",content:"adapter-ok"},finish_reason:"stop"}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
}

test("every configured provider can complete one mocked text request with its expected path and auth",async(t)=>{
  for(const entry of cases)await t.test(entry.provider,async()=>{
    let requestInfo;
    const fetchImpl=async(input,init={})=>{
      const request=input instanceof Request?input:null;
      const url=new URL(request?.url??String(input));
      const headers=new Headers(request?.headers);
      new Headers(init.headers).forEach((value,key)=>headers.set(key,value));
      requestInfo={url,headers,method:init.method??request?.method??"GET"};
      return Response.json(responseFor(entry.kind));
    };
    const model=createProviderChatModel({provider:entry.provider,apiKey:"test-key",modelId:"test-model",baseURL:entry.baseURL},{fetchImpl});
    const result=await generateText({model,prompt:"Say adapter-ok",maxOutputTokens:12});
    assert.equal(result.text,"adapter-ok");
    assert.equal(requestInfo.url.pathname,entry.path);
    assert.equal(requestInfo.method,"POST");
    const auth=entry.auth.startsWith("x-api-key:")?`x-api-key:${requestInfo.headers.get("x-api-key")}`:entry.auth.startsWith("x-goog-api-key:")?`x-goog-api-key:${requestInfo.headers.get("x-goog-api-key")}`:requestInfo.headers.get("authorization");
    assert.equal(auth,entry.auth);
    if(entry.provider==="anthropic")assert.equal(requestInfo.headers.get("anthropic-version"),"2023-06-01");
  });
});
