export type JsonParseError = { message: string; line: number; column: number };
export type JsonParseResult = { value: unknown; error: null } | { value: null; error: JsonParseError };

export function parseJson(text: string): JsonParseResult;
export function formatJson(text: string, spaces?: number): string;
export function minifyJson(text: string): string;
export function sortKeys<T>(value: T): T;
export function jsonStats(value: unknown): { keys: number; depth: number };
export function fixJson(text: string, spaces?: number): string;
export function toXml(value: unknown): string;
export function toCsv(value: unknown): string;
export function cleanJson<T>(value: T): unknown;
