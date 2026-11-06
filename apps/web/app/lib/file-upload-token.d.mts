export const FILE_UPLOAD_LIMITS: {
  maxBytes: number;
  maxGuestBytes: number;
  maxGuestTotalBytes: number;
  maxGuestFiles: number;
  tokenTtlMs: number;
};

export function fileUploadTokenOptions(pathname: string, now?: number, maximumSizeInBytes?: number): {
  maximumSizeInBytes: number;
  validUntil: number;
  addRandomSuffix: boolean;
  allowOverwrite: boolean;
  cacheControlMaxAge: number;
};
