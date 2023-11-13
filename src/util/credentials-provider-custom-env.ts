import { CredentialsProviderError } from '@smithy/property-provider';

const ENV_KEY = '_ACCESS_KEY_ID';
const ENV_SECRET = '_SECRET_ACCESS_KEY';
const ENV_SESSION = '_SESSION_TOKEN';
const ENV_EXPIRATION = '_CREDENTIAL_EXPIRATION';

export const fromCustomEnv = (prefix: string) => async () => {
  const accessKeyId = process.env[prefix + ENV_KEY];
  const secretAccessKey = process.env[prefix + ENV_SECRET];
  const sessionToken = process.env[prefix + ENV_SESSION];
  const expiry = process.env[prefix + ENV_EXPIRATION];
  if (accessKeyId && secretAccessKey) {
    return {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken && { sessionToken }),
      ...(expiry && { expiration: new Date(expiry) }),
    };
  }
  throw new CredentialsProviderError('Unable to find environment variable credentials.');
};
