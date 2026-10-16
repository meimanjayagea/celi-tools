export function formatJson(text: string, spaces?: number): string;
export function fixJson(text: string, spaces?: number): string;
export function toXml(value: unknown): string;
export function toCsv(value: unknown): string;
export function cleanJson<T>(value: T): unknown;
