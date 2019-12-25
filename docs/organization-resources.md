- [Managing your AWS Organization as code](#managing-your-aws-organization-as-code)
  - [Why this is important](#why-this-is-important)
  - [Example Template](#example-template)
  - [List of Resource Types](#list-of-resource-types)
    - [MasterAccount](#masteraccount)
    - [Account](#account)
    - [OrganizationRoot](#organizationroot)
    - [OrganizationalUnit](#organizationalunit)
    - [ServiceControlPolicy](#servicecontrolpolicy)
    - [PasswordPolicy](#passwordpolicy)

## Managing your AWS Organization as code

### Why this is important

Just like with resources within your AWS Account managing AWS Organization resources allows you to apply changes to these resources automatically, reducing manual work, inconsistencies and mistakes.

If you are considering to use an account vending machine (e.g. [AWS Control Tower](https://aws.amazon.com/controltower/)) to create and manage new accounts within your organization: Do realize that the account vending machine allows you to quickly create organization resources but only has limited facilities when it comes to updating and maintaining these resoruces.


### Example Template

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

### List of Resource Types

Organization Formation supports the following AWS Organization resources:

#### MasterAccount

MasterAccount is the AWS Account that functions as the master account within your organization.

**Type** OC::ORG::MasterAccount

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|AccountName|Name of the master account |This property is required.<br/><br/>Changing the name of the AWS MasterAccount resource is not possible, this requires the root account to log in to the master account and change this manually.<br/><br/>However, it is possible to change the AccountName of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|AccountId|AccountId of the master account|This property is required.<br/><br/>Changing the AccountId of the master account is not supported.|
|RootEmail|RootEmail of the master account|This property is optional.<br/><br/>Changing the RootEmail of the MasterAccount AWS resource is not possible, this requires the root account to log in to the master account and change this manually. <br/><br/>However, it is possible to change the RootEmail of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on the MasterAccount|
|PasswordPolicy|Reference|This property is optional.<br/><br/>Reference to the [PasswordPolicy](#passwordpolicy) resource that must be  enforced on the MasterAccount.|
|Alias|IAM alias|This property is optional.<br/><br/>The [IAM Alias](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html) associated with the account. Organization Formation supports a maximum of 1 IAM alias per account|
|Tags|Dictionary|This property is optional.<br/><br/>Dictionary that contains the tags on the MasterAccount resource|

**Example**

```yaml
    Type: OC::ORG::MasterAccount
    Properties:
      Alias: org-formation-master
      AccountName: My Organization Formation Master Account
      AccountId: '123456789012'
      ServiceControlPolicies: !Ref ServiceControlPolicy
      PasswordPolicy: !Ref PasswordPolicy
      Tags:
        tag1: Value of Tag
        tag2: Value of Tag 2
```

**!Ref** Returns the AccountId of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountName returns the AccountName of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.Alias returns the IAM alias of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountId returns the AccountId of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.RootEmail returns the RootEmail of the MasterAccount resource.

**!GetAtt** *&lt;logicalId&gt;*.Tags.*&lt;Key&gt;* returns the value of tag *&lt;Key&gt;* for the MasterAccount resource.

#### Account

Account is an AWS Account within your organization.

**Type** OC::ORG::Account

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|AccountName|Name of the account |This property is required.<br/><br/>Changing the name of the AWS Account resource is not possible, this requires the root account to log in to the account and change this manually. <br/><br/>However, it is possible to change the AccountName of the Account in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|AccountId|AccountId of account|This property is optional.<br/><br/>Changing the AccountId of the account is not supported|
|RootEmail|RootEmail of the account|This property is optional (only if AccountId is specified)<br/><br/>Changing the RootEmail of the Account AWS resource is not possible, this requires the root account to log in to the master account and change this manually. <br/><br/>However, it is possible to change the RootEmail of the MasterAccount in the template and this change will be reflected when doing a !GetAtt on the resource from within a template.|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on the Account.|
|PasswordPolicy|Reference|This property is optional.<br/><br/>Reference to the [PasswordPolicy](#passwordpolicy) resource that must be  enforced on the Account.|
|Alias|IAM alias|This property is optional.<br/><br/>The [IAM Alias](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html) associated with the account. Organization Formation supports a maximum of 1 IAM alias per account|
|Tags|Dictionary|This property is optional.<br/><br/>Dictionary that contains the tags on the Account resource|

**Note** When creating an account the RootEmail and AccountName are used to create the Account resource in AWS. The AccountId property can later be added as a means of ‘documentation’ but this is not required.

**!Ref** Returns the AccountId of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountName returns the AccountName of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.Alias returns the IAM alias of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.AccountId returns the AccountId of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.RootEmail returns the RootEmail of the Account resource.

**!GetAtt** *&lt;logicalId&gt;*.Tags.*&lt;Key&gt;* returns the value of tag *&lt;Key&gt;* for the Account resource.

**Example**

```yaml
  MyAccount1:
    Type: OC::ORG::Account
    Properties:
      RootEmail: my-aws-account-1@org-formation.com
      Alias: org-formation-account-1
      AccountName: Org Formation Sample Account 1
      AccountId: '123456789012'
      ServiceControlPolicies: !Ref ServiceControlPolicy
      PasswordPolicy: !Ref PasswordPolicy
      Tags:
        tag1: Value of Tag
        tag2: Value of Tag 2
```


#### OrganizationRoot

OrganizationRoot is the AWS Root Resource that functions like a top-level Organizational Unit within your Organization.

**Type** OC::ORG::OrganizationRoot

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on all accounts (including master account) within the AWS Organization.|

**Note** Any account (or master account) within an AWS organization that is not part of an Organizational Unit will be a member of the Organizational Root.

**!Ref** Returns the physical id of the OrganizationRoot resource.

**Example**

```yaml
  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
      ServiceControlPolicies:
        - !Ref DenyChangeOfOrgRoleSCP
        - !Ref RestrictUnusedRegionsSCP
```


#### OrganizationalUnit

OrganizationalUnit is an AWS Organizational Unit within your organization and can be used to group accounts and apply policies to the accounts within the organizational unit.

**Type** OC::ORG::OrganizationalUnit

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|OrganizationalUnitName|Name of the organizational unit|This property is required.
|Accounts|Reference or list of References|This property is optional.<br/><br/>Reference or list of References to [Account](#account) resources that need to be part of the Organizational Unit.
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) resources that must be enforced on all accounts (including master account) within the AWS Organization.|

**Note** It is currently not supported to nest organizational units (have an OU as the parent of another OU). It is also not possible to add a MasterAccount resource to an OU.

**!Ref** Returns the physical id of the OrganizationalUnit resource.

**Example**

```yaml
  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      ServiceControlPolicies:
        - !Ref DenyChangeOfOrgRoleSCP
      Accounts:
        - !Ref DevelopmentAccount1
        - !Ref DevelopmentAccount2
```


#### ServiceControlPolicy

ServiceControlPolicy is an [AWS Service Control Policy](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scp.html) that can be used to manage permissions within the accounts contained in your organization.

**Type** OC::ORG::ServiceControlPolicy

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|PolicyName|Name of the SCP|This property is required.
|Description|Description of the SCP|This property is optional.
|PolicyDocument|Policy Document|This property is optional.

**!Ref** Returns the physical id of the ServiceControlPolicy resource.

**Example**

```yaml
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


#### PasswordPolicy

PasswordPolicy is an [AWS IAM Password Policy](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html) that applies to all IAM Users within the account.

**Type** OC::ORG::PasswordPolicy

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|MaxPasswordAge|number|This property is optional.
|MinimumPasswordLength|number|This property is optional.
|RequireLowercaseCharacters|boolean|This property is optional.
|RequireNumbers|boolean|This property is optional.
|RequireSymbols|boolean|This property is optional.
|RequireUppercaseCharacters|boolean|This property is optional.
|PasswordReusePrevention|number|This property is optional.
|AllowUsersToChangePassword|boolean|This property is optional.

**Example**

```yaml
  PasswordPolicy:
    Type: OC::ORG::PasswordPolicy
    Properties:
      MaxPasswordAge: 30
      MinimumPasswordLength: 12
      RequireLowercaseCharacters: true
      RequireNumbers: true
      RequireSymbols: true
      RequireUppercaseCharacters: true
      PasswordReusePrevention: 5
      AllowUsersToChangePassword: true
```
