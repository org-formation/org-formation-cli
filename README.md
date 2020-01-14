# AWS Organization Formation

Makes managing [AWS Organizations](https://aws.amazon.com/organizations/) easy!

Organization Formation allows you to manage AWS Organization resources and accounts using CloudFormation syntax.

- [AWS Organization Formation](#aws-organization-formation)
  - [Installation](#installation)
  - [Getting started](#getting-started)
    - [I already have an AWS Organization](#i-already-have-an-aws-organization)
    - [I would like to create a new AWS Organization from scratch](#i-would-like-to-create-a-new-aws-organization-from-scratch)

  - [Examples](examples/readme.md)
  - [Managing AWS Organizations as code](docs/organization-resources.md)
  - [Managing resources across accounts](docs/cloudformation-resources.md)
  - [Updating multiple templates at once](docs/task-files.md)
  - [CLI reference](docs/cli-reference.md)
  - [Changelog](CHANGELOG.md)

## Installation

```
> npm i aws-organization-formation
```

## Getting started
The intended user for this tool is anyone that manages an [AWS Organizations](https://aws.amazon.com/organizations/). You might already have an Organization set up using a different tool (e.g. landingzone, control tower) or you might want to start from scratch. Either way: this tool helps you manage you AWS Organizations resources and Cloudformation templates across your AWS Accounts.

### I already have an AWS Organization

Great! you might not only already have an AWS Organization but also know some of the challanges when managing other resources (CoudTrail, GuardDuty, centralized logging, shared services) across your accounts.

To get started you first need an ``org-formation`` template that describes all your Organization resources such as [Accounts](./docs/organization-resources.md#account), [OUs](./docs/organization-resources.md#organizationalunit) and [SCPs](docs/organization-resources.md#servicecontrolpolicy).

After [Installation](#installation) you can generate this file using the following command:

```
> org-formation init organization.yml  --region us-east-1 [--profile org-master-account]
```

<details>
<summary>
example output organization.yml file
</summary>

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization:
  Root:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: My Organization Root
      AccountId: '123123123123'
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref RestrictUnusedRegionsSCP

  ProductionAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: production@myorg.com
      AccountName: Production Account
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  DevelopmentAccount:
    Type: OC::ORG::Account
    Properties:
      RootEmail: development@myorg.com
      AccountName: Development Account
      Tags:
        budget-alarm-threshold: '2500'
        account-owner-email: my@email.com

  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      Accounts:
        - !Ref DevelopmentAccount

  ProductionOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: production
      Accounts:
        - !Ref ProductionAccount

  RestrictUnusedRegionsSCP:
    Type: OC::ORG::ServiceControlPolicy
    Properties:
      PolicyName: RestrictUnusedRegions
      Description: Restrict Unused regions
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: DenyUnsupportedRegions
            Effect: Deny
            NotAction:
              - 'cloudfront:*'
              - 'iam:*'
              - 'route53:*'
              - 'support:*'
            Resource: '*'
            Condition:
              StringNotEquals:
                'aws:RequestedRegion':
                  - eu-west-1
                  - us-east-1
                  - eu-central-1
```

</details>


You can make changes to the file you generated  and upate your organization using the ``update`` commmand. Alternatively you can run ``create-change-set`` and ``update-change-set``. Read more in the [cli reference](docs/cli-reference.md)

Once you got the hang of managing organization resources, use these organization resources to write smarter cloudformation that allows you to provision resources across your organization. Read more [about managing resources across accounts](docs/cloudformation-resources.md).

###


### I would like to create a new AWS Organization from scratch

```java
//todo: effectively create an AWS Organization and follow steps above.
```