export type AuthConfigurationStatus = {
  available: boolean;
  email: boolean;
  google: boolean;
  registration: boolean;
};

export function authConfigurationStatus(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): AuthConfigurationStatus;
