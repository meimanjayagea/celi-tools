export type RaceResult = { count:number; completed:number; statuses:Record<string,number>; networkErrors:number; aborted:number; canceled:boolean; timedOut:boolean; durationMs:number; minMs:number|null; maxMs:number|null; averageMs:number|null };
export function validateRaceOptions(options:{count:number;schedule:string;now?:number}):{count:number;scheduledAt:number|null};
export function runRace(request:{url:string;method:string;headers:Headers;body?:string}, options:{count:number;signal?:AbortSignal;timeoutMs?:number;onProgress?:(completed:number)=>void}):Promise<RaceResult>;
