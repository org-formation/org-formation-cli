# AWS OrganizationFormation
Aws Organization Formation is an extension to AWS CloudFormation that helps you manage resources across your AWS Organization.

AWS OrganizationFormation adds 2 distinct features to CloudFormation:
1. The ability to maintain Organization resources (Accounts, Organizational Units, Service Control Policies) in a CloudFormation section called Organization.
2. New resources types that help setting up common patterns within a multi account AWS organization.

## Installation
```
> npm i aws-organization-formation
```

## Getting started
the following command will initialize organization formation and create an organization template.
```
> org-formation init organization.yml [--profile my-aws-profile]
```

after changing the organization template use:
```
> org-formation update organization.yml [--profile my-aws-profile]
```

or
```
> org-formation create-change-set organization.yml [--profile my-aws-profile]
```
and
```
> org-formation execute-change-set changeSetName [--profile my-aws-profile]
```

## Example Template

```yml
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

## Reference
