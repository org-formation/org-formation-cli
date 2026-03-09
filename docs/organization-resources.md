- [Managing your AWS Organization as code](#managing-your-aws-organization-as-code)
  - [Why this is important](#why-this-is-important)
  - [Example Template](#example-template)
  - [List of Resource Types](#list-of-resource-types)
    - [MasterAccount](#masteraccount)
    - [Account](#account)
    - [OrganizationRoot](#organizationroot)
    - [OrganizationalUnit](#organizationalunit)
    - [ServiceControlPolicy](#servicecontrolpolicy)
    - [Policy](#policy)
    - [PasswordPolicy](#passwordpolicy)

## Managing your AWS Organization as code

### Why this is important

Just like with the resources within your AWS Account, managing AWS Organization resources **as code** allows you to apply changes automatically, reducing manual work, inconsistencies and mistakes.

If you are considering to use an account vending machine (e.g. [AWS Control Tower](https://aws.amazon.com/controltower/)) to create and manage new accounts within your organization: Do realize that the account vending machine allows you to quickly create organization resources but only has limited facilities when it comes to updating and maintaining these resources.


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
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) or [Policy](#policy) resources that must be enforced on the MasterAccount<br/><br/>**Note:** Despite the name, this property accepts all policy types (SCPs, RCPs, Tag Policies, Backup Policies, etc.).|
|Policies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [Policy](#policy) resources that must be enforced on the MasterAccount.<br/><br/>**Note:** This is an alias for ServiceControlPolicies with a clearer name. Both properties can be used together and will be merged.|
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
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) or [Policy](#policy) resources that must be enforced on the Account.<br/><br/>**Note:** Despite the name, this property accepts all policy types (SCPs, RCPs, Tag Policies, Backup Policies, etc.).|
|Policies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [Policy](#policy) resources that must be enforced on the Account.<br/><br/>**Note:** This is an alias for ServiceControlPolicies with a clearer name. Both properties can be used together and will be merged.|
|PasswordPolicy|Reference|This property is optional.<br/><br/>Reference to the [PasswordPolicy](#passwordpolicy) resource that must be  enforced on the Account.|
|Alias|IAM alias|This property is optional.<br/><br/>The [IAM Alias](https://docs.aws.amazon.com/IAM/latest/UserGuide/console_account-alias.html) associated with the account. Organization Formation supports a maximum of 1 IAM alias per account|
|Tags|Dictionary|This property is optional.<br/><br/>Dictionary that contains the tags on the Account resource|
|SupportLevel| 'enterprise' (or empty) |This property is optional.<br/><br/>When changed a ticket will be created to change the support level of the account.<br/><br/>Value must be same as master account support level in AWS|
|OrganizationAccessRoleName| String | Name of the role that needs to be used when accessing this account. <br/><br/>If account gets created with a non-default value for this attribute the role will be created in the account. <br/><br/>Otherwise, when changing this value you are expected to set up the role yourself|

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
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) or [Policy](#policy) resources that must be enforced on all accounts (including master account) within the AWS Organization.<br/><br/>**Note:** Despite the name, this property accepts all policy types (SCPs, RCPs, Tag Policies, Backup Policies, etc.).|
|Policies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [Policy](#policy) resources that must be enforced on all accounts within the AWS Organization.<br/><br/>**Note:** This is an alias for ServiceControlPolicies with a clearer name. Both properties can be used together and will be merged.|
|DefaultOrganizationAccessRoleName| String | Default value for the OrganizationAccessRoleName attributes of accounts within the organization.<br/><br/>For more information see the [Account](#account) resources|
|DefaultBuildAccessRoleName| String | Default value for the TaskRoleName of tasks, this value can be different from the DefaultOrganizationAccessRoleName value. OrganizationAccess is used to set up the account, BuildProcessAccess is used to deploy resources to these accounts.
|CloseAccountsOnRemoval| boolean | If set to true, [Account](#account) resources removed from `organization.yml` will be closed.
|DefaultDevelopmentBuildAccessRoleName| String | When configured, this value will be used instead of `DefaultBuildAccessRoleName` when running using the `--dev` flag

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
|ServiceControlPolicies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [ServiceControlPolicy](#servicecontrolpolicy) or [Policy](#policy) resources that must be enforced on all accounts within the Organizational Unit.<br/><br/>**Note:** Despite the name, this property accepts all policy types (SCPs, RCPs, Tag Policies, Backup Policies, etc.).|
|Policies|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [Policy](#policy) resources that must be enforced on all accounts within the Organizational Unit.<br/><br/>**Note:** This is an alias for ServiceControlPolicies with a clearer name. Both properties can be used together and will be merged.|
|OrganizationalUnits|Reference or list of References |This property is optional. <br/><br/>Reference or list of References to [OrganizationalUnit](#OrganizationalUnit) resources that must be nested within the current OrganizationalUnit.|


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

**Note:** This resource type is maintained for backwards compatibility. For new implementations, consider using the [Policy](#policy) resource type which supports all AWS Organizations policy types.

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


#### Policy

Policy is a generic [AWS Organizations Policy](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies.html) resource that supports all policy types available in AWS Organizations, including authorization policies (SCPs, RCPs) and management policies (Tag, Backup, AI Services Opt-Out, Chatbot, Declarative, Security Hub, Inspector, Bedrock, Upgrade Rollout, S3, and Network Security Director policies).

**Type** OC::ORG::Policy

**Properties**

|Property |Value|Remarks|
|:---|:---|:---|
|PolicyName|Name of the Policy|This property is required.
|Description|Description of the Policy|This property is optional.
|PolicyType|Type of the Policy|This property is required. Must be one of: `SERVICE_CONTROL_POLICY`, `RESOURCE_CONTROL_POLICY`, `TAG_POLICY`, `BACKUP_POLICY`, `AISERVICES_OPT_OUT_POLICY`, `CHATBOT_POLICY`, `DECLARATIVE_POLICY_EC2`, `SECURITYHUB_POLICY`, `INSPECTOR_POLICY`, `UPGRADE_ROLLOUT_POLICY`, `BEDROCK_POLICY`, `S3_POLICY`, `NETWORK_SECURITY_DIRECTOR_POLICY`
|PolicyDocument|Policy Document|This property is required. The structure depends on the PolicyType.

**!Ref** Returns the physical id of the Policy resource.

**Policy Type Details**

- **SERVICE_CONTROL_POLICY**: Controls maximum available permissions for IAM principals in member accounts
- **RESOURCE_CONTROL_POLICY**: Controls maximum available permissions for resources in member accounts
- **TAG_POLICY**: Standardizes tags attached to AWS resources
- **BACKUP_POLICY**: Centrally manages backup plans for AWS resources
- **AISERVICES_OPT_OUT_POLICY**: Controls data collection for AWS AI services
- **CHATBOT_POLICY**: Controls access from chat applications like Slack and Microsoft Teams
- **DECLARATIVE_POLICY_EC2**: Declares and enforces desired EC2 configurations
- **SECURITYHUB_POLICY**: Centrally manages Security Hub configurations
- **INSPECTOR_POLICY**: Centrally enables and manages Amazon Inspector
- **BEDROCK_POLICY**: Enforces Amazon Bedrock Guardrails for model inference calls
- **UPGRADE_ROLLOUT_POLICY**: Manages automatic upgrades across AWS resources
- **S3_POLICY**: Centrally manages S3 configurations
- **NETWORK_SECURITY_DIRECTOR_POLICY**: Manages network security configurations

For detailed information about each policy type, see the [AWS Organizations Policy Types documentation](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies.html).

**Example - Resource Control Policy**

```yaml
  RestrictPublicS3BucketsRCP:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: RestrictPublicS3Buckets
      PolicyType: RESOURCE_CONTROL_POLICY
      Description: Prevent S3 buckets from being made public
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: DenyPublicS3Buckets
            Effect: Deny
            Principal: '*'
            Action:
              - 's3:PutBucketPublicAccessBlock'
            Resource: '*'
            Condition:
              StringNotEquals:
                's3:ResourceAccount': '${aws:PrincipalAccount}'
```

**Example - Tag Policy**

```yaml
  RequireEnvironmentTagPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: RequireEnvironmentTag
      PolicyType: TAG_POLICY
      Description: Require Environment tag on all resources
      PolicyDocument:
        tags:
          Environment:
            tag_key:
              '@@assign': Environment
            tag_value:
              '@@assign':
                - Production
                - Development
                - Staging
            enforced_for:
              '@@assign':
                - 's3:bucket'
                - 'ec2:instance'
```

**Example - Backup Policy**

```yaml
  DailyBackupPolicy:
    Type: OC::ORG::Policy
    Properties:
      PolicyName: DailyBackups
      PolicyType: BACKUP_POLICY
      Description: Daily backup policy for critical resources
      PolicyDocument:
        plans:
          DailyBackupPlan:
            regions:
              '@@assign':
                - us-east-1
                - eu-west-1
            rules:
              DailyBackupRule:
                schedule_expression:
                  '@@assign': 'cron(0 5 ? * * *)'
                start_backup_window_minutes:
                  '@@assign': '60'
                complete_backup_window_minutes:
                  '@@assign': '120'
                lifecycle:
                  delete_after_days:
                    '@@assign': '30'
            selections:
              tags:
                BackupDaily:
                  iam_role_arn:
                    '@@assign': 'arn:aws:iam::$account:role/BackupRole'
                  tag_key:
                    '@@assign': 'Backup'
                  tag_value:
                    '@@assign':
                      - 'Daily'
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
