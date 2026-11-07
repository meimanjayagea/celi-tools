type StreamChunk=
  | {type:"start";messageId:string}
  | {type:"start-step"|"finish-step"|"abort"}
  | {type:"text-start"|"text-end";id:string}
  | {type:"text-delta";id:string;delta:string}
  | {type:"error";errorText:string}
  | {type:"finish";finishReason:"stop"|"error"};
export function uiStreamWithFallback(input:{writer:{write(chunk:StreamChunk):void};profiles:Array<{id:string}>;signal?:AbortSignal;createStream:(profile:{id:string},signal?:AbortSignal)=>AsyncIterable<string>|Promise<AsyncIterable<string>>;createId?:()=>string;onComplete?:(message:{id:string;text:string})=>void|Promise<void>;safeErrorText?:string}):Promise<void>;
