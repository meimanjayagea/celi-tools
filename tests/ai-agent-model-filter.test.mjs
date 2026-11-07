import test from "node:test";
import assert from "node:assert/strict";
import { countModelFilters, filterModels } from "../apps/web/app/lib/ai-agent/model-filter.mjs";

const models=[
  {id:"free-chat",name:"Free Chat",isFree:true},
  {id:"paid-chat",name:"Paid Chat",isFree:false},
  {id:"gemini-2.5-flash",name:"Gemini 2.5 Flash",isFree:null},
];

test("All model filter keeps every selectable model including unknown pricing",()=>{
  assert.deepEqual(filterModels(models,"","all"),models);
});

test("Free, paid, and unknown model filters select only known matching prices",()=>{
  assert.deepEqual(filterModels(models,"","free"),[models[0]]);
  assert.deepEqual(filterModels(models,"","paid"),[models[1]]);
  assert.deepEqual(filterModels(models,"","unknown"),[models[2]]);
  assert.deepEqual(countModelFilters(models),{all:3,free:1,paid:1,unknown:1});
});

test("Model search matches both display names and IDs within the selected filter",()=>{
  assert.deepEqual(filterModels(models,"GEMINI","all"),[models[2]]);
  assert.deepEqual(filterModels(models,"paid-chat","paid"),[models[1]]);
  assert.deepEqual(filterModels(models,"gemini","free"),[]);
});
