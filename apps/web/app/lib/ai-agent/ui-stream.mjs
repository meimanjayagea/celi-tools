import { randomUUID } from "node:crypto";
import { streamWithFallback } from "./failover-policy.mjs";

export async function uiStreamWithFallback({writer,profiles,signal,createStream,createId=randomUUID,safeErrorText="Bantuan AI sementara tidak tersedia. Coba lagi nanti."}) {
  let started=false;
  const messageId=createId();
  const textId=createId();
  const start=()=>{
    if(started)return;
    started=true;
    writer.write({type:"start",messageId});
    writer.write({type:"start-step"});
    writer.write({type:"text-start",id:textId});
  };
  try {
    for await(const delta of streamWithFallback({profiles,signal,createStream})) {
      start();
      writer.write({type:"text-delta",id:textId,delta});
    }
  } catch {
    if(signal?.aborted) {
      if(started)writer.write({type:"abort"});
      return;
    }
    if(!started)throw new Error(safeErrorText);
    writer.write({type:"error",errorText:safeErrorText});
    writer.write({type:"text-end",id:textId});
    writer.write({type:"finish-step"});
    writer.write({type:"finish",finishReason:"error"});
    return;
  }
  start();
  writer.write({type:"text-end",id:textId});
  writer.write({type:"finish-step"});
  writer.write({type:"finish",finishReason:"stop"});
}
