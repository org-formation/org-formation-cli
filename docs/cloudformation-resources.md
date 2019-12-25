- [Managing resources across accounts](#managing-resources-across-accounts)
  - [OrganizationBinding: Where to create which resource](#organizationbinding-where-to-create-which-resource)
  - [Creating cross account resource dependencies](#creating-cross-account-resource-dependencies)
  - [Referencing the account the resource is created in](#referencing-the-account-the-resource-is-created-in)
  - [Foreach: Iterating over accounts when creating resources](#foreach-iterating-over-accounts-when-creating-resources)


## Managing resources across accounts

[CloudFormation](https://aws.amazon.com/cloudformation/) is the infrastructure as code solution native to AWS. It works great when managing resources within a single organization but doesnt contain syntax to manage resources across multiple accounts.

examples:
- In CloudFormation it is not possible to specify a !Ref to another resource in another account or region.
- In CloudFormation it is not possible to reference organization resource attributes
- In CloudFormation it is possible to deploy stacks to multiple accounts (using [StackSets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/what-is-cfnstacksets.html)) but only a subset of Cloudformation features can be used.

The constraints above can be difficult when managing a baseline of resources across different accounts in an AWS Organization:
- Relationships between resources in different accounts/regions are important.
- Variability in resource configuration needs to be managed centranlly and relative to the account resource

Organization Formation allows you to define any CloudFormation resource and annotate this with additional attributes that contain information about how these should be bound to the accounts within your organization.

**example**:
In this example a IAM Group will be created in the SharedUsersAccount and a IAM Role will be created in all accounts. The IAM Role however can only be assume from the SharedUserAccount and the Group can only assume this specific Role.

```yaml
AWSTemplateFormatVersion: 2010-09-09-OC

# include organization template.
Organization: !Include ./organization.yml

# default region (can be list)
OrganizationBindingRegion: eu-central-1

Resources:

  # this resource will only be created in the SharedUsersAccount
  DeveloperGroup:
    OrganizationBinding:
      Account: !Ref SharedUsersAccount
    Type: AWS::IAM::Group
    Properties:
      GroupName: DevelopersGroup
      Policies:
        - PolicyName: assume-roles
          PolicyDocument:
            Version: 2012-10-17
            Statement:
              - Effect: Allow
                Action: sts:AssumeRole
                Resource: arn:aws:iam::*:role/DeveloperRole

  # this resource will only be created in all accounts (except the organizational master)
  DeveloperRole:
    OrganizationBinding:
      Account: '*'
    Type: AWS::IAM::Role
    Properties:
      ManagedPolicyArns:
      - arn:aws:iam::aws:policy/PowerUserAccess
      RoleName: DeveloperRole
      AssumeRolePolicyDocument:
       Version: 2012-10-17
       Statement:
         - Effect: Allow
           Action: sts:AssumeRole
           Principal:
            AWS: !Ref SharedUsersAccount # role can only be assumed from SharedUsersAccount
```

### OrganizationBinding: Where to create which resource
In Orgnization Formation every resource can have an ```OrganizationBinding``` attribute. This attribute specifies in which accounts the resource must be created. The ```OrganizationBinding``` atribute looks like:

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


|Attribue |Value|Remarks|
|:---|:---|:---|
|Region|String or list of String|Resource will be created in all the specified resources.|
|Account|literal '*'|Resource will be created in all accounts **except** for the master account.|
||!Ref or list of !Ref|Resource will be created in [Accounts](#account) that are referred to.|
|OrganizationalUnit|!Ref or list of !Ref|Resource will be created in all accounts that below to the [OrganizationalUnits](#organizationalunit) that are refered to.|
|ExcludeAccount|!Ref or list of !Ref|Resource will **not** be created in [Accounts](#account) that are referred to.|
|IncludeMasterAccount|```true``` or ```false```| If ```true```, resource will be created in the organizational master account.|
|AccountsWithTag|tag-name|Resource will be created in all accounts that have a tag specified with tag-name.|

Attributes can be combined and are **additive** (except for ```ExcludeAccount```).





### Creating cross account resource dependencies

If you have a resource that you need to refer to from within another resource (using ```!Ref``` or ```!GetAtt```) Organization Formation helps you to do this across AWS accounts.

As every resource has its own ```OrganizationBinding``` and therefore will need to be added to a different set of accounts Organization Formation creates a template specific to every target account refered to from within the template.

If, within a template, you use ```!Ref``` ir ```!GetAtt``` to refer to another resource in another account Organization Formation will create an export in the template that exposes the resource and create a parameter in the template that uses the value. It will work exactly how you would expect it to in cloudformation.

**example**:

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
OrganizationBindingRegion: eu-central-1

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

**note**: The above will only work if resource ```CloudTrailS3Bucket``` only is bound to 1 account and region. If a resource is deployed to multiple accounts, you can alternatively use the syntax ```!Ref ComplianceAccount.Resources.CloudTrailS3Bucket``` or ```!GetAtt ComplianceAccount.Resources.CloudTrailS3Bucket.Arn```.


### Referencing the account the resource is created in

In CloudFormation it is possible to reference the accountId of the account the resource is created in using ```AWS::AccountId``` and the region using ```AWS::Region```. As Organization Formation template are regular cloudformation this remains possible.

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


### Foreach: Iterating over accounts when creating resources

If, in Organization Formation, you need to create a resource ```for each``` account in a specific selection you can do so with a Foreach attribute.

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

In the example above a ```Member``` resource will be created in the ```Master``` for each account in the selector ```Account: '*'```. The [account](#account) that is iterated over can be accessed using ```CurrentAccount```.

The ``Foreach`` attribute is has the same expressiveness as the [OrganizationBinding](#organizationbinding-where-to-create-which-resource) but does not support ``Region``.

Please consider the following template for some more context. It sets up [GuardDuty](https://aws.amazon.com/guardduty/) for a complete organization using 3 resources!

```yaml
AWSTemplateFormatVersion: '2010-09-09-OC'

Organization: !Include ./organization.yml
OrganizationBindingRegion: eu-central-1

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
- The ``MasterAccount`` gets a Member resource for each account that is refered to from the ``Master`` resource in that account.

yes, the creation of ``Master`` resources to 'Members' and ``Member`` ressources to the Master account is confusing. This, unfortunately, is how Guardduty works in CloudFormation.

