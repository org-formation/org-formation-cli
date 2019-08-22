# AWS OrganizationFormation
Aws Organization Formation is an extension to AWS CloudFormation that helps you manage resources across your AWS Organization.

AWS OrganizationFormation adds 2 distinct features to CloudFormation:
1. The ability to maintain Organization resources (Accounts, Organizational Units, Service Control Policies) in a CloudFormation section called Organization.
2. New resources types that help setting up cross account permissions for common patterns within a multi account AWS organization.

## Installation
```
> npm i aws-oranization-formation
```

## Getting started
If you already have an organization set up in AWS,
[follow this link](../blob/master/LICENSE).

If you would like to create a new organization,
[follow this link](../blob/master/LICENSE).


## Examples

```yml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization:
  Root:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: My Organization Root
      AccountId: '123123123123'

  ProductionAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: production@myorg.com
      AccountName: Production Account

  DevelopmentAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: development@myorg.com
      AccountName: Development Account

Resources:
  # Topic will be created in all accounts (ProductionAccount & DevelopmentAccount)

  Topic:
    Type: AWS::CloudFormation::Topic
    OrganizationBindings:
      Regions: eu-central-1
      Accounts: '*'
    Properties:
      TopicName: MyTopic

```

## Reference
