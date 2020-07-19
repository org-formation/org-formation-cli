
<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [OrganizationBinding: Where to create which resource](#organizationbinding-where-to-create-which-resource)
- [Creating cross account resource dependencies](#creating-cross-account-resource-dependencies)
- [DependsOnAccount and DependsOnRegion](#dependsonaccount-and-dependsonregion)
- [Referencing the account the resource is created in](#referencing-the-account-the-resource-is-created-in)
- [Foreach: Iterating over accounts when creating resources](#foreach-iterating-over-accounts-when-creating-resources)
- [Fn::EnumTargetAccounts/Regions](#fnenumtargetaccountsregions)
- [Fn::TargetCount](#fntargetcount)

<!-- /code_chunk_output -->

For Examples see: [examples folder](../examples/readme.md)

# Organization Annotated CloudFormation

[CloudFormation](https://aws.amazon.com/cloudformation/) is the infrastructure as code solution native to AWS. It works great when managing resources within a single organization but doesn't contain syntax to manage resources across multiple accounts.

examples:
- In CloudFormation it is not possible to specify a !Ref to a resource in another account or region.
- In CloudFormation it is not possible to reference organization resource attributes such as Account tags.
- In CloudFormation it is possible to deploy stacks to multiple accounts (using [StackSets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/what-is-cfnstacksets.html)) but only a subset of CloudFormation features can be used.

The constraints above can be difficult when managing a baseline of resources across different accounts in an AWS Organization:
- Relationships between resources in different accounts/regions are important.
- Variability in resource configuration needs to be managed centrally and relative to the account resource

Organization Formation allows you to define any CloudFormation resource and annotate this with additional attributes that contain information about how these should be bound to the accounts within your organization.

Org-Formation templates that contain resources can be updated using:
``> org-formation update-stacks template.yml --stack-name stackName``

More information in the [CLI reference](cli-reference.md)

**example**: In this example an IAM Role will be created in accounts enumerable by `RoleBinding` (all accounts except the `*` from which `SharedUsersAccount` is excluded). Only principals from accounts enumerable by `AssumeRoleBinding` (only `SharedUsersAccount`) can assume the Role.

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

# Include file that contains Organization Section.
# The Organization Section describes Accounts, Organizational Units, etc.
Organization: !Include ./organization.yml

# Any Binding that does not explicitly specify a region will default to this.
# Value can be either string or list
DefaultOrganizationBindingRegion: eu-central-1

Parameters:

  roleName:
    Type: String

  rolePolicyArns:
    Type: CommaDelimitedList

# Section contains a named set of Bindings.
# Bindings determine what resources are deployed where
# These bindings can be !Ref'd from the Resources in the resource section
OrganizationBindings:

  AssumeRoleBinding:
    Account: !Ref SharedUsersAccount

  RoleBinding:
    Account: '*'
    ExcludeAccount: !Ref SharedUsersAccount

Resources:

  Role:
    OrganizationBinding: !Ref RoleBinding
    Type: AWS::IAM::Role
    Properties:
      ManagedPolicyArns: !Ref rolePolicyArns
      RoleName: !Ref roleName
      AssumeRolePolicyDocument:
       Version: 2012-10-17
       Statement:
         - Effect: Allow
           Action: sts:AssumeRole
           Principal:
            AWS: Fn::EnumTargetAccounts AssumeRoleBinding '${account}' # role can only be assumed from accounts in AssumeRoleBinding

  AssumeRolePolicy:
    Type: AWS::IAM::ManagedPolicy
    OrganizationBinding: !Ref AssumeRoleBinding
    Properties:
      ManagedPolicyName: !Sub '${resourcePrefix}-${roleName}-assume-role-policy'
      PolicyDocument:
        Version: 2012-10-17
        Statement:
          - Effect: Allow
            Action: sts:AssumeRole
            Resource: Fn::EnumTargetAccounts RoleBinding 'arn:aws:iam::${account}:role/${roleName}'
```

### OrganizationBinding: Where to create which resource
In Organization Formation, in order to create resources, these resources should have an `OrganizationBinding` attribute.

The `OrganizationBinding` can be specified as a top-level `DefaultOrganizationBinding`, within a `OrganizationBindings` section or directly on the CloudFormation Resource.


```yaml
Resources:
  Bucket:
    OrganizationBinding:
      Region: eu-west-1
      Account:
       - !Ref Account1
       - !Ref Account2
    Type: AWS::S3::Bucket
```

In the example above the resource Bucket will be created for Account1 and Account2 in the eu-west-1 region.

There is a lot of other ways to specify an account binding though:


|Attribute |Value|Remarks|
|:---|:---|:---|
|Region|String or list of String|Resource will be created in all the specified resources.|
|Account|literal '*'|Resource will be created in all accounts **except** for the master account.|
||!Ref or list of !Ref|Resource will be created in [Accounts](#account) that are referred to.|
|OrganizationalUnit|!Ref or list of !Ref|Resource will be created in all accounts that below to the [OrganizationalUnits](#organizationalunit) that are referred to. This includes accounts created within nested OU's|
|ExcludeAccount|!Ref or list of !Ref|Resource will **not** be created in [Accounts](#account) that are referred to.|
|IncludeMasterAccount|``true`` or ``false``| If ``true``, resource will be created in the organizational master account.|
|AccountsWithTag|tag-name|Resource will be created in all accounts that have a tag specified with tag-name.|

Attributes can be combined and are **additive** (except for ```ExcludeAccount```).


### Creating cross account resource dependencies

If you have a resource that you need to refer to from within another resource (using ``!Ref`` or ``!GetAtt``) Organization Formation helps you to do this across AWS accounts.

As every resource has its own ``OrganizationBinding`` and therefore will need to be added to a different set of accounts Organization Formation creates a template specific to every target account referred to from within the template.

If, within a template, you use ``!Ref`` or ``!GetAtt`` to refer to another resource in another account Organization Formation will create an export in the template that exposes the resource and create a parameter in the template that uses the value. It will work exactly how you would expect it to in CloudFormation.

**example**:

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
DefaultOrganizationBindingRegion: eu-central-1

Resources:

  CloudTrailS3Bucket:
    OrganizationBinding:
      Account: !Ref ComplianceAccount
    DeletionPolicy: Retain
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'cloudtrail-${ComplianceAccount}'

  # omitted some resources like bucket policy

  CloudTrail:
    OrganizationBinding:
      Account: '*'
      IncludeMasterAccount: true
    Type: AWS::CloudTrail::Trail
    Properties:
      # this will, in any account, resolve to the name of CloudTrailS3Bucket in the ComplianceAccount.
      S3BucketName: !Ref CloudTrailS3Bucket
      IsLogging: false

```

**note**: The above will only work if resource ``CloudTrailS3Bucket`` only is bound to 1 account and region. If a resource is deployed to multiple accounts, you can alternatively use the syntax ``!Ref ComplianceAccount.Resources.CloudTrailS3Bucket`` or ``!GetAtt ComplianceAccount.Resources.CloudTrailS3Bucket.Arn``.

### DependsOnAccount and DependsOnRegion

Sometimes a dependency exists on the sequence in which CloudFormation templates are executed - even if there is no cross-account resource dependency.

A dependency to all templates within an account or region can be created manually using ``DependsOnAccount`` or ``DependsOnRegion``.

In the example below all CloudFormation templates that contain the ``Master`` resource (Accounts: `*`) will be executed after all templates bound to ``!Ref MasterAccount`` completed execution.

Note that circular dependencies will fail to execute.

```yaml
Resources:
  Master:
    DependsOnAccount: !Ref MasterAccount
    Type: AWS::GuardDuty::Master
    OrganizationBinding:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      MasterId: !Ref MasterAccount
  Member:
    Type: AWS::GuardDuty::Member
    OrganizationBinding:
      IncludeMasterAccount: true
    Foreach:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      Email: !GetAtt CurrentAccount.RootEmail
      MemberId: !Ref CurrentAccount
      Status: Invited
      DisableEmailNotification: true
```

### Referencing the account the resource is created in

In CloudFormation it is possible to reference the accountId of the account the resource is created in using ``AWS::AccountId`` and the region using ``AWS::Region``. As Organization Formation template are regular CloudFormation this remains possible.

Organization Formation adds a way to reference the account resource of the account for which the resource is created using  **AWSAccount**

**example**
```yaml
  Budget:
    Type: AWS::Budgets::Budget
    OrganizationBinding:
      Account: '*'
    Properties:
      Budget:
        BudgetName: !Sub '${resourcePrefix}-budget-${AWSAccount.Alias}'
        BudgetLimit:
          Amount: !GetAtt AWSAccount.Tags.budget-alarm-threshold
          Unit: USD
        TimeUnit: MONTHLY
        BudgetType: COST
```

The list of properties that can be accessed on an ``Account`` resource, be it via ``!GetAtt`` or from within a ``!Sub`` are:

|expression|notes|
|-------|-------|
|AccountName|Returns the AccountName of the Account resource.|
|Alias|Returns the IAM alias of the Account resource.|
|AccountId|Returns the AccountId of the Account resource.|
|RootEmail|Returns the RootEmail of the Account resource.|
|Tags.*&lt;Key&gt;*|Returns the value of tag *&lt;Key&gt;* for the Account resource.|

**!Ref** Returns the AccountId of the Account resource.


### Foreach: Iterating over accounts when creating resources

If, in Organization Formation, you need to create a resource ``for each`` account in a specific selection you can do so with a Foreach attribute.

**example**
```yaml
  Member:
    Type: AWS::GuardDuty::Member
    OrganizationBinding:
      IncludeMasterAccount: true
    Foreach:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      Email: !GetAtt CurrentAccount.RootEmail
      MemberId: !Ref CurrentAccount
      Status: Invited
      DisableEmailNotification: true
```

In the example above a ``Member`` resource will be created in the ``Master`` for each account in the selector ``Account: '*'``. The [account](#account) that is iterated over can be accessed using ``CurrentAccount``.

The ``Foreach`` attribute is has the same expressiveness as the [OrganizationBinding](#organizationbinding-where-to-create-which-resource) but does not support ``Region``.

Please consider the following template for some more context. It sets up [GuardDuty](https://aws.amazon.com/guardduty/) for a complete organization using 3 resources!

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
DefaultOrganizationBindingRegion: eu-central-1

Resources:
  Detector:
    Type: AWS::GuardDuty::Detector
    OrganizationBinding:
      Account: '*'
      IncludeMasterAccount: true
    Properties:
      Enable: 'true'
  Master:
    DependsOnAccount: !Ref MasterAccount
    Type: AWS::GuardDuty::Master
    OrganizationBinding:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      MasterId: !Ref MasterAccount
  Member:
    Type: AWS::GuardDuty::Member
    OrganizationBinding:
      IncludeMasterAccount: true
    Foreach:
      Account: '*'
    Properties:
      DetectorId: !Ref Detector
      Email: !GetAtt CurrentAccount.RootEmail
      MemberId: !Ref CurrentAccount
      Status: Invited
      DisableEmailNotification: true
```

The template above specifies that:
- Every account, including the master account, gets a ``Detector`` resource.
- Ever account, except for the master account, gets a ``Master`` resource.
- The ``MasterAccount`` gets a Member resource for each account that is referred to from the ``Master`` resource in that account.

yes, the creation of ``Master`` resources to 'Members' and ``Member`` resources to the Master account is confusing. This, unfortunately, is how Guardduty works in CloudFormation.


### Fn::EnumTargetAccounts/Regions

`Fn::EnumTargetAccounts` and `Fn::EnumTargetRegions` will take a named binding as argument and output an array with an element for either each account or region. The value of the element can be formatted as using a 2nd argument that will be interpreted as a Sub-expression.

e.g:

``` yaml
Principal:
  AWS: Fn::EnumTargetAccounts MyBinding arn:aws:iam::${account}:root

 ```

 Will result in the following CloudFormation (assuming MyBinding has 3 accounts):

``` yaml
Principal:
  AWS:
    - arn:aws:iam::111111111111:root
    - arn:aws:iam::222222222222:root
    - arn:aws:iam::333333333333:root

 ```
**note**:

- The Sub expression can have single quotes
- The Sub expression may also contain other Sub expression constructs (such as Ref to parameter)
- For `Fn::EnumTargetAccounts` use the pre-defined variable `${account}` in the Sub expression
- For `Fn::EnumTargetRegions` use the pre-defined variable `${region}` in the Sub expression
- When placed inside an array the output of `Fn::EnumTargetAccounts` and `Fn::EnumTargetRegions` will be inserted into the array.


### Fn::TargetCount
`Fn::TargetCount` will return the number of targets for a binding (regions * accounts).

This is particularly useful when creating resources in which Fn::EnumTargetAccounts is used to create an array of values foreach target. If the array is empty (the `Fn::TargetCount` returns 0) this function can be used within a condition to not create the resource at all.


e.g:

``` yaml

Conditions:
  CreatePolicy: !Not [ !Equals [ Fn::TargetCount MyBinding, 0 ] ]

Resources:
  Policy:
    Type: AWS::S3::BucketPolicy
    Condition: CreatePolicy
    Properties:
          Bucket: !Ref Bucket
          PolicyDocument:
            Statement:
              - Sid: 'my statement'
                Action: '*'
                Effect: "Allow"
                Resource: '*'
                Principal:
                  AWS: Fn::EnumTargetAccounts MyBinding arn:aws:iam::${account}:root
 ```

 Will result in the following CloudFormation (assuming MyBinding has 0 accounts):

``` yaml

Conditions:
  CreatePolicy: !Not [ !Equals [ 0, 0 ] ] # evaluates to false

Resources:
  Policy:
    Type: AWS::S3::BucketPolicy
    Condition: CreatePolicy  # resource will not be created
    Properties:
          Bucket: !Ref Bucket
          PolicyDocument:
            Statement:
              - Sid: 'my statement'
                Action: '*'
                Effect: 'Allow'
                Resource: '*'
                Principal:
                  AWS: [] # empty array is not 'legal'
 ```

Syntactically the resource is not correct but as it will not be created (because of the condition) there wont be an error. Yay!
