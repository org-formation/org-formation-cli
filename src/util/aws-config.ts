import { ClientCredentialsConfig } from './aws-types';

export class AWSConfig {
  credentials?: ClientCredentialsConfig;
  region?: string;

  private static sharedInstance: AWSConfig | null = null;

  private constructor() {
    this.credentials = undefined;
    this.region = undefined;
  }

  static shared(): AWSConfig {
    if(AWSConfig.sharedInstance === null) {
      AWSConfig.sharedInstance = new AWSConfig();
    }
    return AWSConfig.sharedInstance;
  }
}
