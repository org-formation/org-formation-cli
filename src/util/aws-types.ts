import { AwsCredentialIdentity, Provider } from '@smithy/types';

export type ClientCredentialsConfig = AwsCredentialIdentity | Provider<AwsCredentialIdentity>;

export interface DefaultClientConfig {
  credentials?: ClientCredentialsConfig;
  region?: string;
  stsRegionalEndpoints?: 'legacy' | 'regional';
};
