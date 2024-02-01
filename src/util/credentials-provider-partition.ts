import { CredentialsProviderError } from '@smithy/property-provider';
import { AwsCredentialIdentity, AwsCredentialIdentityProvider } from '@smithy/types';

export function partitionFromEnv(isPartition: boolean): AwsCredentialIdentityProvider {
  return async () => {
    const accessKeyId = process.env.GOV_AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.GOV_AWS_SECRET_ACCESS_KEY;

    if (isPartition && accessKeyId && secretAccessKey) {
      const identity: AwsCredentialIdentity = {
        accessKeyId,
        secretAccessKey,
      };
      return identity;
    }
    throw new CredentialsProviderError('GOV_AWS_ACCESS_KEY_ID or GOV_AWS_SECRET_ACCESS_KEY missing', true);
  };
}
