import { App, Construct, StackProps, Stack } from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import sns = require('@aws-cdk/aws-sns');

class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    new sns.Topic(this, 'MyTopic');
    new s3.Bucket(this, 'MyBucket');
  }
}

const app = new App();
new MyStack(app, 'MyStack');
app.synth();