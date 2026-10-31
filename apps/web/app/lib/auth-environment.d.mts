export type AuthConfigurationStatus = {
  available: boolean;
  email: boolean;
  google: false;
  registration: boolean;
};

export function authConfigurationStatus(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): AuthConfigurationStatus;
