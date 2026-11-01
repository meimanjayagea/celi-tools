export const FILE_UPLOAD_LIMITS: {
  maxBytes: number;
  tokenTtlMs: number;
};

export function fileUploadTokenOptions(pathname: string, now?: number): {
  maximumSizeInBytes: number;
  validUntil: number;
  addRandomSuffix: boolean;
  allowOverwrite: boolean;
  cacheControlMaxAge: number;
};
