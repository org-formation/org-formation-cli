# Managing your AWS Organization using org-formation.

For those unfamiliar with AWS Organizations: AWS Organizations is an AWS service that can be used to create new AWS Accounts and associate these with a master account, the AWS account you used to enable the Organizations service.

Having multiple AWS Accounts and using AWS Organizations to manage these accounts has a number of benefits including:

- **Reduce** the impact of mistakes (or security incidents) in any of your accounts.
- **Scale** in terms of resource limits over different accounts.
- **Simplify** adhering to security principles like 'least privilege' across different systems.

For more information and considerations on how to set up your AWS Organization you can also refer to this article: [Off to a great start with AWS Organizations](https://dev.to/oconijn/off-to-a-great-start-with-aws-organizations-1i74).

## AWS Organization Formation

AWS Organization Formation (`org-formation` for short) is a open source and community supported tool that allows you to manage different aspects of your AWS Organization through Infrastructure as Code (IaC). Managing your AWS Organization as code allows you to store the definition (or 'code') that describes your AWS Organization in a sourcecode repository and automate the deployment of changes. This will decrease the likelihood of human errors when making changes and greatly improving the auditability of changes made to your AWS Organization.

AWS Organization Formation supports 3 main features:

1. Managing the AWS Organizations resources as code, e.g. creating a new AWS Account, Organizational Unit or Service Control Policy.
2. Annotating CloudFormation templates with Organization Bindings that describe _what_ CloudFormation resources need to be deployed _where_ and the relations between these resources.
3. Automated deployment of changes to not only your AWS Organizations resources, but also the Annotated CloudFormation templates and other resources like CDK or Serverless.com projects.

First step is installing org-formation using npm. This can be done using the following command:

```bash
\> npm i aws-organization-formation -g
```

## Generating an organization.yml file

In order to start using `org-formation` you will need to create an `organization.yml` file. The `organization.yml` file will contain the definition of your AWS Organizations resources. You don't have to create this file by hand, org-formation allows you to generate a `organization.yml` using the `init` command.

The `init` command can be run regardless of what tool you have used to create the AWS Organization. It can also be run at a later point in time to recreate a new organization.yml file if needed.

The following command will generate an organization.yml file for your organization:

```bash
\> org-formation init organization.yml --region eu-central-1
```

**Note that**

1. The `--region` option is required as the `init` command will create an S3 bucket and the --region option is used to specify the region the bucket must be created in.
2. A `--profile` option can optionally be used to reference an AWS profile configured in the aws cli. The AWS credentials used (either the default credential or those associated with the profile specified) must give access to the AWS Account that contains the AWS Organization resources (the 'Master Account') and have sufficient right to interact with the AWS Organization service and assume roles within the accounts contained within the AWS Organization.
3. By default the S3 bucket used to store state is named `organization-formation-${masterAccountId}`. However, you can change the name of the bucket (using the `--state-bucket-name` option) and the name of the object org-formation uses to store state (`--state-object` option).

If all went well, you now have a file that is called organization.yml in your current directory that will contain all the different resources currently contained within AWS Organizations in your master account.

For example:

```yaml
AWSTemplateFormatVersion: "2010-09-09-OC"
Description: default template generated for organization with master account 111222333444

Organization:
  MasterAccount:
    Type: OC::ORG::MasterAccount
    Properties:
      AccountName: My Organization Master Account
      AccountId: "111222333444"

  OrganizationRoot:
    Type: OC::ORG::OrganizationRoot

  ProductionOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: production
      Accounts: !Ref ProductionAccount

  DevelopmentOU:
    Type: OC::ORG::OrganizationalUnit
    Properties:
      OrganizationalUnitName: development
      Accounts:
        - !Ref DevelopmentAccount

  ProductionAccount:
    Type: OC::ORG::Account
    Properties:
      AccountName: Production Account
      AccountId: "111111111111"
      RootEmail: aws-accounts+production@myorg.com

  DevelopmentAccount:
    Type: OC::ORG::Account
    Properties:
      AccountName: Development Account
      AccountId: "222222222222"
      RootEmail: aws-accounts+dev@myorg.com
```

In the example above you can find the following resources:

- **MasterAccount**. This resource is of type `OC::ORG::MasterAccount` and refers to the AWS Account that contains the AWS Organization resources. A MasterAccount resource must be part of your template and it must have an `AccountId` attribute. The value of this attribute will be compared with the `AccountId` stored in the state file and the AWS Account deploying changes to in order to prevent mistakes updating the wrong AWS Account. Apart from this requirement the MasterAccount can have all the attributes any other Account resource has.
- **OrganizationRoot**. This resource, of type `OC::ORG::OrganizationRoot`, is the root object for the hierarchical structure that contains accounts and organizational units. This resource can be used to attach Service Control Policies to all of the accounts within the organization.
- **ProductionOU** and **DevelopmentOU**: These resources, of type `OC::ORG::OrganizationRoot`, are 2 Organizational Units. In this example these are contained within the OrganizationRoot. Organizational Units can be used to contains AWS Accounts, other Organizational Units and/or apply Service Control Policies to accounts within the Organizational Unit.
- **ProductionAccount** and **DevelopmentAccount**: These resources, of type `OC::ORG::Account`, are 2 AWS Accounts. In this example contained in respectively the ProductionOU and DevelopmentOU Organizational Units. The relationship is created by adding a `!Ref` to the `Accounts` attribute of the Organizational Unit.

Unlike the **OrganizationRoot** and **MasterAccount** the number of **Organizational Units** and **Accounts** in your organization.yml will depend on the number of Organizational Units and Accounts that exist in your organization when generating the file. You might also have **Service Control Policy** resources in your organization.yml file if you had these configured in AWS.

Any of these resources might have been created by `org-formation` or by another tool. Frankly this doesn't matter much as from now on we can use the organization.yml file to manage (Create/Update/Delete) these resources by changing them in the organization.yml file and executing the `org-formation update` command.

**Note** AWS Accounts cannot be deleted using an API. If you remove an AWS Account from the organization.yml file it won't get removed but 'forgotten'. The account can later be re-added by adding it to the organization.yml file, but while not present in the organization.yml file the account cannot be used as a reference. If you want to delete an AWS Account, you need to log in as root and delete the account from within the console.

## Updating AWS Organizations resources

If you have an organization.yml file that described your AWS Organization resources you can make changes to these resources and run `org-formation update organization.yml` to apply these changes to the AWS Organization in your master account.

You simply change the file and run the `org-formation update` command. e.g:

```bash
\> org-formation update organization.yml
```

**Note that**

1. The `--region` option is not there as no regional resources will be created (AWS Organizations is only available in`us-east-1`).
2. The state bucket is expected to have been created by an `init` command perform prior to update. If you provided a `--state-bucket-name` (or `--state-object`) option to the `init` command you need to pass these options to the `update` command as well.

Having different state buckets (or state objects) can be a good idea when testing changes to your organization resources locally. Setting up a way to test changes locally (as opposed to a centrally managed CodePipeline) is somewhat more involved than create sepparate S3 buckets but since the state stored in S3 will be updated after every change you make to your organization it can be used too ensure the _main pipeline_ will not skip a task because it was already executed locally.

If you want to review changes to your organization before applying them you can use the `org-formation create-change-set` command to create a change set and `execute-change-set` to apply the changes after review.

```bash
\> org-formation create-change-set organization.yml --change-set-name my-change-set
```

```bash
\> org-formation execute-change-set my-change-set
```

**Note** that `--change-set-name` is optional when creating a changeset. By default a random identifier is used as the changeset name.

### Creating a new AWS Account

You can add a new AWS Account by adding it to your organization.yml file. As you don't know the `AccountId` of your new account the `RootEmail` will be used as an unique identifier for the AWS Account. The console output will contain the AccountId after creating the account and you can add it to the organization.yml later if you choose, but this is not required. The AccountId (or in other words: the physical id of an AWS Account) will be stored in the state file in S3.

Adding a new AWS Account to the organization file:

```yaml
MyNewAccount:
  Type: OC::ORG::Account
  Properties:
    AccountName: My New Account
    RootEmail: aws-accounts+new@myorg.com
```

Note that:

1. AWS Accounts that do not belong to an Organizational Unit are added to the Organization Root. You can add an account to an Organizational Unit by adding the account to the Accounts attribute (using `!Ref LogicalName`). The `Accounts` attribute can be either an array or singel !Ref.
2. The root user for this newly created account will not have a password. In order to log in as root you need to reset your root password using the email address configured as RootEmail. This email therefore also needs to be unique. AWS accepts email addresses that contain a '+' symbol. Most mail providers allow a '+' to create another email address for the same mailbox. This can be useful if you want password recovery emails (and other emails that relate to your accounts) all to be send to the same mailbox.

If you have additional steps that need to be performed after creating an account, like notifying another department by email or adding the newly created account to list of accounts on your wiki, you can use AWS EventBridge (or CloudWatch Events) to subscribe to AWS Accounts being created by org-formation. The eventSource for these events is `oc.org-formation` the event is called `AccountCreated`.

An example on how to integrate a simple step function can be found here: https://github.com/OlafConijn/AwsOrganizationFormation/tree/master/examples/automation/create-account

### Additional OC::ORG::Account Attributes

In addition to `AccountName`, `RootEmail` and `AccountId` you can specify the following other attributes:

- `ServiceControlPolicies` can be used to apply a (list of) Service Control Policies to your AWS Account.
- `Tags` can be used to add metadata to AWS Accounts. Adding Tags to your accounts is particularly useful because the value of these tags can be resolved using by `!GetAtt` in org-formation Annotated CloudFormation templates and the value of the tags can be used to configure resources within these accounts.
- `Alias` can be used to create an IAM Alias associated to the account. This makes logging in to the account easier as you don't have to use the 12 digit account id but can use the IAM Alias instead.
- `PasswordPolicy` can be used to set up a password policy for the account being created.
- `SupportLevel` can be used to set the support level of the new account to 'enterprise' - if enterprise support is enabled in the master account.

An example of a fully configured AWS Account could look like the following:

```yaml
MyNewAccount:
  Type: OC::ORG::Account
  Properties:
    AccountName: My New Account
    RootEmail: aws-accounts+new@myorg.com
    SupportLevel: enterprise
    Alias: org-newacc
    PasswordPolicy: !Ref PasswordPolicy
    Tags:
      Subdomain: newaccount.myorg.com
      BudgetThreshold: 100
      AccountOwnerEmail: olaf@myorg.com

PasswordPolicy:
  Type: OC::ORG::PasswordPolicy
  Properties:
    MinimumPasswordLength: 12
    RequireLowercaseCharacters: true
    RequireNumbers: true
    RequireSymbols: true
    RequireUppercaseCharacters: true
    AllowUsersToChangePassword: true
```

Information about other resources that can be created can be found here: https://github.com/OlafConijn/AwsOrganizationFormation/blob/master/docs/organization-resources.md

## Creating a Code Pipeline using org-formation.

Since Infrastructure as code is particularly useful when stored in source control and applied automatically upon commit (or merge) org-formation has a command to set up such a pipeline in AWS. Running the `init-pipeline` command is a lot like the `init` command but instead of creating a file on disk it will create **CodeCommit**, **CodeBuild** and **CodePipeline** resource and create an initial check-in that contains the organization.yml file for your organization and all other files needed to automatically deploy changes to this file.

```bash
\> org-formation init-pipeline organization.yml --region eu-central-1
```

This command will create an initial commit with the following files:

```bash
<repository root>
├── 000-organization-build
│   └── org-formation-build.yml
│   └── org-formation-role.yml
│   └── organization-tasks.yml
├── .org-formationrc
├── buildspec.yml
├── organization-parameters.yml
├── organization-tasks.yml
└── organization.yml
```

- **organization.yml** file is the file you would have created on your local disk using the `init` command.
- **buildspec.yml** contains instructions to run org-formation upon every check in to master. Running org-formation is done using the `perform-tasks` command which allows you to run any number of tasks from within a tasks file.
- **organization-tasks.yml** is a org-formation tasks file that contains 2 tasks: a task of type `update-organization` which is used to apply all changes made to the organization.yml file (if any) and an `update-stacks` task that can be used to change the pipeline itself.
- **templates/org-formation-build.yml** contains the cloudformation template that was used to create the AWS resources and can be used to modify these.

Contents of the organization-tasks.yml file, as generated by the `init-pipeline` command:

```yaml
OrganizationUpdate:
  Type: update-organization
  Template: ./organization.yml

OrganizationBuild:
  Type: update-stacks
  Template: ./templates/org-formation-build.yml
  StackName: organization-formation-build
  Parameters:
    stateBucketName: organization-formation-111222333444
    resourcePrefix: orgformation
    repositoryName: organization-formation
  DefaultOrganizationBindingRegion: eu-central-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: true
```

## Automating deployments using task files

New AWS accounts within your organization typically also comes with a basic set of resources created within these accounts. Updating your organization therefore likely is a process with multiple steps. In order to do this org-formation has a command called `perform-tasks`. The `perform-tasks` command can be run to execute tasks that you would like to be part of the organization build pipeline.

The task file needs to contain at least one `update-organization` task that will be executed before all other tasks. If other tasks reference a organization.yml file this file must always be the same file specified in the update-organization task.

A task file can contain the following task types:

- **update-organization** used to update the organization resources in the master account.
- **update-stacks** used to create/update CloudFormation templates in the accounts that are part of your organization.
- **include** used to include another tasks file.
- **update-cdk** used to execute a CDK project in the accounts that are part of your organization.
- **update-serverless.com** used to execute a Serverless.com project in the accounts that are part of your organization.
- **copy-to-s3** used to copy a local file to S3.

An example of a task file may look like the following:

```yaml
OrganizationUpdate:
  Type: update-organization
  Template: ./organization.yml

UpdateStack:
  Type: update-stacks
  Template: ./templates/mytemplate.yml
  StackName: my-stack-name
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    Account: "*"

IncludeOther:
  DependsOn: UpdateStack
  Type: include
  Path: ./included.yml

CdkWorkload:
  Type: update-cdk
  DependsOn: UpdateStack
  Path: ./workload/
  RunNpmInstall: true
  RunNpmBuild: true
  OrganizationBinding:
    Account: !Ref AccountA
    Region: eu-central-1
```

For all tasks the following attributes can be specified:

- **DependsOn** used to have a task run only after the task(s) specified here have executed successfully.
- **Skip** used to to skip the execution of a task (when set to `true`). Tasks that depend on this task (using `DependsOn` will also be skipped)
- **TaskRoleName** used to specify the name of the AWS IAM Role that will be assumed in the target account when performing the task.

Note that the `perform-tasks` command has options to run multiple tasks concurrently. It also has options to specify a tolerance for failures on both tasks and stacks. If you are into speeding up your deployment try using adding the option `--max-concurrent-stacks 10`. If you want the `perform-tasks` to continue even after a number of tasks have failed you can add the option `--failed-tasks-tolerance 5`. Tasks that depend on tasks that have failed will not be executed but considered failed as well.

## Organization Bindings

A concept at the core of org-formation is the Organization Binding. The Organization Binding allows you to specify a number of target accounts (and regions) and update these accounts at once. Annotated CloudFormation templates can use multiple Organization Bindings and specify exactly which resources need to be deployed where.

An Organization Binding always specifies both the target accounts and target regions. The targets that are used are all the possible combinations of regions and accounts, for example: a Organization Binding with 2 regions and 3 accounts will have 6 targets. But also: an Organization binding with 0 regions and 6 accounts will not have any targets.

Since Annotated CloudFormation templates can have multiple binding there is the option to specify a default (set of) regions using `DefaultOrganizationBindingRegion`. This prevents you from falling into the trap of forgetting to specify a region and not having your resources deployed anywhere.

An Organization Binding can have the following attributes:

- **Region** used to specify the region (or regions) this binding needs to create targets for.
- **Account** used to include a specific account (or list of accounts) that this binding needs to create targets for. You can also use '\*' to specify all accounts except for the master account.
- **IncludeMasterAccount** used to include the MasterAccount in the targets (when set to `true`) .
- **OrganizationalUnit** used to include accounts from an Organizational Unit (or list of Organizational Units).
- **AccountsWithTag** used to include all accounts that declare a specific tag in the organization file.
- **ExcludeOrganizationalUnit** used to exclude accounts from an Organizational Unit (or list of Organizational Units).
- **ExcludeAccount** used to exclude a specific account (or list of accounts) from the targets.

All references use the logical names as declared in the organizational.yml file and accounts that are not part of the organizational model are not used to create a target for.

### Examples of Organization Bindings

Simple list of accounts in eu-west-1

```yaml
OrganizationBinding:
  Region: eu-west-1
  Account:
    - !Ref Account1
    - !Ref Account2
```

All accounts in your organization (including the master accounts) in both eu-west-1 and eu-central-1

```yaml
OrganizationBinding:
  Region:
    - eu-west-1
    - eu-central-1
  Account: "*"
  IncludeMasterAccount: true
```

All accounts part of the development OU, except for the SandboxAccount

```yaml
OrganizationBinding:
  Region: eu-west-1
  OrganizationalUnit: development
  ExcludeAccount: !Ref SandboxAccount
```

All accounts that declare a subdomain tag

```yaml
OrganizationBinding:
  Region: eu-central-1
  AccountsWithTag: subdomain
```

All accounts, except for accounts in the sandbox OU

```yaml
OrganizationBinding:
  Region: eu-west-1
  ExcludeOrganizationalUnit: sandbox
```

## Variables and Parameters in the task file

From within the task file it is possible to reference attributes from the organization.yml using `!Ref`, `!GetAtt` and `!Sub` (or any combination!). This can be useful if you want parameterize the tasks (or Parameters of a task) using information in your organization.

For example:

```yaml
SomeTemplate:
  Type: update-stacks
  Template: ./cloudtrail.yml
  StackName: variables-example
  StackDescription: !Sub
    - "CloudTrail implementation ${account} with events persisted to ${persistanceAccount}"
    - {
        account: !Ref CurrentAccount,
        persistanceAccount: Ref ComplianceAccount,
      }
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: true
  Parameters:
    accountForPersistance: !Ref ComplianceAccount
    enable: !GetAtt CurrentAccount.Tags.enableCloudTrail
```

Any account in the organization.yml can be referred to by its logical name. The account that is part of the current task and target (when executing the task) can be referred to by `CurrentAccount`.

Custom parameters can also be declared in a top-level `Parameters` attribute in the task file. These parameters can have default values and be overwritten by adding a `--parameters` option to the `perform-tasks` command.

Declaring and specifying parameter values when running the `perform-tasks` command:

```bash
\> org-formation perform-tasks organization-tasks.yml --parameters stackPrefix=test includeMaster=false
```

```yaml
Parameters:
  stackPrefix:
    Description: will be used a prefix for stack names.
    Type: String
    Default: my

  includeMasterAccount:
    Description: if true the bucket template will be deployed to the master account
    Type: Boolean
    Default: true

OrganizationUpdate:
  Type: update-organization
  Template: ./organization.yml

BucketTemplate:
  Type: update-stacks
  Template: ./bucket.yml
  StackName: !Sub ${stackPrefix}-scenario-stack-parameters
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: !Ref includeMasterAccount

IncludeOther:
  DependsOn: BucketTemplate
  Type: include
  Path: ./included-task-file.yml
  Parameters:
    stackPrefix: other-prefix
```

In the example above you can see how the parameters are:

1. Used in a `StackName` attribute, to avoid colliding stack names when re-using or testing the tasks file.
1. Used in an Organization Binding to conditionally include the Master Account
1. Passed down to an include task. If nothing is specified in the `Parameters` attribute of the include task, parameter values from the parent task file are passed down to included task files. In this example the parameter `stackPrefix` is assigned a specific value in the included task file but the value from `includeMasterAccount` will remain the same.

In addition to organization attributes and parameters, CloudFormation exports can be queried using the `!CopyValue` function. As opposed to CloudFormations native `!ImportValue` function the stack (and the resources within the stack) that declares the output can be deleted also after the value was _copied_ from the export. `!CopyValue` can also be used cross account and cross region whereas `!ImportValue` only works within the same Account and Region.

Below you can see 4 examples on how a task (PolicyTemplate) uses a value exported by another task (BucketTemplate) and assigns it to a parameter.

```yaml
BucketTemplate:
  Type: update-stacks
  Template: ./bucket.yml
  StackName: scenario-export-bucket
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: true

PolicyTemplate:
  DependsOn: BucketTemplate
  Type: update-stacks
  Template: ./bucket-policy.yml
  StackName: scenario-export-bucket-role
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    IncludeMasterAccount: true
  Parameters:
    bucketArn: !CopyValue "BucketArn"
    bucketArn2: !CopyValue ["BucketArn", !Ref MasterAccount]
    bucketArn4: !CopyValue ["BucketArn", !Ref MasterAccount, "eu-west-1"]
    bucketArn3: !CopyValue ["BucketArn", 123123123123, "eu-west-1"]
```

The `!CopyValue` function can declare up to 3 arguments

- **ExportName**, the 1st argument, must contain the name of the export of which the value needs to be resolved.
- **AccountId**, the 2nd argument, will _if specified_ contain the Account Id of the account that declares the export. This can be either a hard coded AccountId (12 digits) or `!Ref` to a logical account name in the organization file - which will resolve to the account id when processing the task file.
- **Region**, the 3rd argument, will _if specified_ contain the region that declares the export.

If AccountId and/or Region are not specified the account and region of the target are used. If you have an Organization Binding with 6 targets and do not specify AccountId or Region the export is expected to be found in all 6 targets (Account/Region combinations).

## Protecting Critical resources

There are several ways you can protect critical resources deployed by org formation.
The update-stacks tasks allows you to set the `TerminationProtection` attribute to `true` to prevent a template from being deleted and setting `UpdateProtection` attribute to `true` will prevent any of the resources within the template to be updated using CloudFormation.

Below an example of using `TerminationProtection` and `UpdateProtection` attributes:

```yaml
CriticalResourcesTemplate:
  Type: update-stacks
  Template: ./bucket.yml
  StackName: critical-stack
  TerminationProtection: true
  UpdateProtection: true
  DefaultOrganizationBindingRegion: eu-west-1
  DefaultOrganizationBinding:
    Account: !Ref Production1
```

`TerminationProtection` will cause any call to delete the stack to fail (through the CloudFormation console or org-formation). The `UpdateProtection` will cause updates of any resource using CloudFormation to fail. This feature uses a CloudFormation StackPolicy which can also be explicitly be specified using a `StackPolicy` attribute.

`TerminationProtection`, `UpdateProtection` and `StackPolicy` only apply to changes made using CloudFormation. The resources can still be modified directly in the console or using an api. If you want to ensure absolutely no changes can be made to resources within your accounts you can specify this as a Service Control Policy in the organization.yml file.

An example Service Control Policy that prevents modifying an IAM Role called `ProtectedRole`:

```yaml
RestrictUpdatesOnIAMRoles:
  Type: OC::ORG::ServiceControlPolicy
  Properties:
    PolicyName: RestrictUpdatesOnIAMRoles
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: RestrictIamChanges
          Effect: Deny
          Action:
            - "iam:Update*"
            - "iam:Put*"
            - "iam:Delete*"
            - "iam:Attach*"
            - "iam:Detach*"
          Resource: "arn:aws:iam::*:role/ProtectedRole"
```

The example above will prevent anyone in the organization (including root) to change the ProtectedRole resource in any of the accounts the policy is applied to. If you want to allow only the Organization Build to change these resources you can add a Condition to the Service Control Policy:

```yaml
RestrictUpdatesOnIAMRoles:
  Type: OC::ORG::ServiceControlPolicy
  Properties:
    PolicyName: RestrictUpdatesOnIAMRoles
    PolicyDocument:
      Version: "2012-10-17"
      Statement:
        - Sid: RestrictIamChanges
          Effect: Deny
          Action:
            - "iam:Update*"
            - "iam:Put*"
            - "iam:Delete*"
            - "iam:Attach*"
            - "iam:Detach*"
          Resource: "arn:aws:iam::*:role/ProtectedRole"
          Condition:
            StringNotLike:
              aws:PrincipalARN: arn:aws:iam::*:role/OrganizationAccountAccessRole
```

## Org-formation Annotated CloudFormation templates

Another great feature of org-formation is the ability to add organization aware annotations to regular CloudFormation templates. Regular CloudFormation has no knowledge of organization resources and only supports specifying resources within a template that all need to be deployed to the same target account and region.

Org-formation allows you _for each individual resources within a template_ to specify which account and region the resource needs to be deployed to. The mechanism by which you specify where a resource needs to be deployed to is the same Organization Binding as used within a tasks file. This means that resources within a template can be bound to multiple account/region combinations (e.g. by specifying the binding `Account: '*'`).

**Note** that this is different from CloudFormation StackSets. With the StackSet feature of CloudFormation a Template can be executed in different target accounts and regions. The template however will always be the same for all targets. In practice this means that for any unique set of resources a new CloudFormation template must be created and a lot of work is spent managing the relationships between these templates.

When executing the `org-formation update-stacks` command or adding a `update-stacks` task to a task file, org-formation will generate a CloudFormation templates for each target you specified within your bindings and create the resources bound to that target using CloudFormation.

```bash
\> org-formation update-stacks template.yml --stack-name my-stack
```

An example of an a Annotated CloudFormation template is below:

```yaml
AWSTemplateFormatVersion: "2010-09-09-OC"

# Include file that contains Organization Section.
# The Organization Section describes Accounts, Organizational Units, etc.
Organization: !Include ../organization.yml

# Any Binding that does not explicitly specify a region will default to this.
# Value can be either string or list
DefaultOrganizationBindingRegion: eu-central-1

# Bindings determine what resources are deployed where
# These bindings can be !Ref'd from the Resources in the resource section
# Any Resource that does not specify a binding will use this binding.
# This specific binding selects all accounts from your organization that have a budget-alarm-threshold tag.
DefaultOrganizationBinding:
  AccountsWithTag: budget-alarm-threshold

Resources:
  Budget:
    Type: AWS::Budgets::Budget
    Properties:
      Budget:
        BudgetName: !Sub "budget-${AWSAccount.Alias}" # AWSAccount.Alias resolves to IAM Alias of current account
        BudgetLimit:
          Amount: !GetAtt AWSAccount.Tags.BudgetAlarmThreshold # Resolves to value of tag of current account
          Unit: USD
        TimeUnit: MONTHLY
        BudgetType: COST
      NotificationsWithSubscribers:
        - Notification:
            NotificationType: FORECASTED
            ComparisonOperator: GREATER_THAN
            Threshold: 1
          Subscribers:
            - SubscriptionType: EMAIL
              Address: !GetAtt AWSAccount.Tags.AccountOwnerEmail
```

The template above will, for every account in your organization with a tag `BudgetAlarmThreshold` create a `Budget` resource. In the properties of this resource various references to the organization.yml file are used:

- The `BudgetName` of the Budget resource is a composite of 'budget' and the value of the IAM Alias of the account it is created in. This is useful in order to identify which AWS Account a budget notification applies to.
- The `Amount` of the BudgetLimit is specified to be the value of the tag `BudgetAlarmThreshold` of the account the Budget resource is created in.
- The `Address` of the Email Subscriber is specified to be the value of the tag `AccountOwnerEmail` of the account the Budget resource is created in.

**Note that**

1. When resolving these references, the values are read from the organization.yml file that is included either by `Organization` attribute or by the tasks file. If you manually change the value of the tag in the AWS Console, org-formation will not know. If you change the value of a tag in the organization.yml then org-formation does know that it needs to run both `update-organization` and `update-stacks` for templates that reference tags.
2. The `Organization` attribute does not have to be specified when including a template from within a tasks file. Attributes like `DefaultOrganizationBindingRegion` and the bindings can also be overwritten from within a tasks file.

A reference to `AWSAccount` will resolve to the account the CloudFormation template executes in (very much like `AWS::AccountId`) but any account in the organization.yml file can be referred to by its logical name. e.g: `!GetAtt MyDevAccount.Tags.AccountOwnerEmail` or `!Ref MyDevAccount ` are also valid expressions (assuming you have declared an account named MyDevAccount).

## Cross account references in CloudFormation templates

As org-formation templates contain resources that will be deployed to multiple accounts it can also contain the relationships (`!Ref` or otherwise) between these resources.

For example:

```yaml
AWSTemplateFormatVersion: "2010-09-09-OC"

# Include file that contains Organization Section.
# The Organization Section describes Accounts, Organizational Units, etc.
Organization: !Include ../organization.yml

# Any Binding that does not explicitly specify a region will default to this.
# Value can be either string or list
DefaultOrganizationBindingRegion: eu-central-1

# Section that contains a named list of Bindings.
# Bindings determine what resources are deployed where
# These bindings can be !Ref'd from the Resources in the resource section
OrganizationBindings:
  # Binding for: S3Bucket, S3BucketPolicy
  CloudTrailBucketBinding:
    Account: !Ref ComplianceAccount

  # Binding for: CloudTrail
  CloudTrailBinding:
    Account: "*"
    IncludeMasterAccount: true

Resources:
  S3Bucket:
    OrganizationBinding: !Ref CloudTrailBucketBinding
    DeletionPolicy: Retain
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "cloudtrail-${ComplianceAccount}"

  S3BucketPolicy:
    OrganizationBinding: !Ref CloudTrailBucketBinding
    Type: AWS::S3::BucketPolicy
    DependsOn: S3Bucket
    Properties:
      Bucket: !Ref S3Bucket
      PolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Sid: "AWSCloudTrailAclCheck"
            Effect: "Allow"
            Principal: { Service: "cloudtrail.amazonaws.com" }
            Action: "s3:GetBucketAcl"
            Resource: !Sub "arn:aws:s3:::${CloudTrailS3Bucket}"
          - Sid: "AWSCloudTrailWrite"
            Effect: "Allow"
            Principal: { Service: "cloudtrail.amazonaws.com" }
            Action: "s3:PutObject"
            Resource: !Sub "arn:aws:s3:::${CloudTrailS3Bucket}/AWSLogs/*/*"
            Condition:
              StringEquals:
                s3:x-amz-acl: "bucket-owner-full-control"

  CloudTrail:
    OrganizationBinding: !Ref CloudTrailBinding
    Type: AWS::CloudTrail::Trail
    DependsOn:
      - CloudTrailS3BucketPolicy
    Properties:
      S3BucketName: !Ref S3Bucket
      IsLogging: false
      IncludeGlobalServiceEvents: true
      IsMultiRegionTrail: true
```

What you can see in the example above is a CloudFormation template with 3 resources: `CloudTrail`, `S3Bucket` and `S3BucketPolicy`. The CloudTrail resource will be deployed to all accounts and the `S3Bucket` and `S3BucketPolicy` will only be created in the `ComplianceAccount`.

When executed by org-formation a template will be created for every account in your organization (the `CloudTrail` resource is bound to all accounts). All these templates will contain a `CloudTrail` resource and the template created for the `ComplianceAccount` will additionally contain the `S3Bucket` and `S3BucketPolicy` resources.

The `CloudTrail` resource has a reference to the `S3Bucket` bound to **only** the `ComplianceAccount` in its `S3Bucket` property. What org-formation will do for all accounts that do not have both resources is create a CloudFormation export in the template deployed to the ComplianceAccount and declare a parameter in the templates deployed to all other accounts. When deploying, org-formation will then create a dependency between the templates to ensure the right order of execution and copy the value from the export into the parameter of the other templates when deploying these.

Below you see fragments from the template that will be deployed to the `ComplianceAccount`:

```yaml
Resources:
  S3Bucket:
    DeletionPolicy: Retain
    Type: AWS::S3::Bucket
    Properties:
      BucketName: cloudtrail-111111111111

# ... S3BucketPolicy omitted ....

# Output section generated by org-formation for template deployed to the ComplianceAccount
Outputs:
  printDashCloudTrailS3Bucket:
    Value: !Ref S3Bucket
    Description: Cross Account dependency
    Export:
      Name: mystackname-CloudTrailS3Bucket
```

The cross account expression (`!Ref S3Bucket`) will be copied to the `Value` of the output. This can be any expression, also `!GetAtt` or `!Sub`.

Below you see fragments from the template that will be deployed all accounts, expect for the `ComplianceAccount`:

```yaml
Parameters:
  CloudTrailS3Bucket:
    Description: Cross Account dependency
    Type: String
    ExportAccountId: '340381375986'
    ExportRegion: eu-central-1
    ExportName: mystackname-CloudTrailS3Bucket

 # ... further down in the Resources section ...

 CloudTrail:
  Type: AWS::CloudTrail::Trail
  Properties:
    S3BucketName:
      Ref: CloudTrailS3Bucket
```

**Note** that the `DependsOn` attribute from the original template is also removed. As org-formation understands the relationship between the templates but CloudFormation not there is no use for the DependsOn within the template deployed to CloudFormation.

Being able to use references to organization resources and resources bound to different accounts allows you to create templates that describe entire patterns and best practices that can be applied to a multi account setup. It also allows you to re-use these templates as they do not contain Account Ids or require you to deploy multiple CloudFormation templates.

## Additional CloudFormation Annotations

Once you start modelling different parts of your resource baseline in CloudFormation you will notice that you might need more than just the ability to refer to organization resources or resources across accounts/regions. Two other features that can be useful are:

1. `ForeachAccount` attribute. Specifying a binding as the value of this attribute will create a copy of the resource for each account in the binding. This can be useful when setting up host names and certificates in your MasterAccount for each account that needs one or when implementing GuardDuty and applying this to all accounts in your organization.
2. `Fn::EnumTargetAccounts` function. This function allows you to create an array of values for each account in a binding. This can be used when setting up cross account IAM permissions that adhere to the principle of least-privilege.

Below you see an example of the use of ForeachAccount:

```yaml
Member:
  Type: AWS::GuardDuty::Member
  OrganizationBinding:
  	IncludeMasterAccount: true
  ForeachAccount:
  	Accounts: '*'
  Properties:
    DetectorId: !Ref Detector
    Email: !GetAtt CurrentAccount.RootEmail
    MemberId: !Ref CurrentAccount
    Status: Invited
    DisableEmailNotification: true
```

In this example a `Member` resource will be created for each account in the specified binding (`Accounts: '*'`). The resources contained in the generated CloudFormation will be prefixed with the accountId. When creating a resource foreach account in the binding `CurrentAccount` can be used to resolve information about the account being iterated over. AWSAccount will still refer to the AWS Account the template is created for (in this case the MasterAccount).

A full example on how to implement GuardDuty using org-formation can be found here: https://github.com/OlafConijn/AwsOrganizationFormation/blob/master/examples/templates/guardduty.yml

Below you see an example of the use of `Fn::EnumTargetAccounts` to create a resource policy and provide access to other accounts:

```yaml
OrganizationBindings:
  # Binding for: Bucket, BucketPolicy
  BucketAccountBinding:
    Account: !Ref MyAccount

  # Binding for: S3BucketReadAccessPolicy
  ReadAccessAccountBinding: # default = empty binding

Conditions:
  CreateReadBucketPolicy:
    !Not [!Equals [Fn::TargetCount ReadAccessAccountBinding, 0]]

Resources:
  Bucket:
    Type: AWS::S3::Bucket
    OrganizationBinding: !Ref BucketAccountBinding
    DeletionPolicy: Retain
    Properties:
      BucketName: !Sub "${bucketName}"

  BucketReadPolicy:
    Type: AWS::S3::BucketPolicy
    OrganizationBinding: !Ref BucketAccountBinding
    Condition: CreateReadBucketPolicy
    Properties:
      Bucket: !Ref Bucket
      PolicyDocument:
        Statement:
          - Sid: "Read operations on bucket"
            Action:
              - s3:Get*
              - s3:List*
            Effect: "Allow"
            Resource:
              - !Sub "${Bucket.Arn}"
              - !Sub "${Bucket.Arn}/*"
            Principal:
              AWS: Fn::EnumTargetAccounts ReadAccessAccountBinding arn:aws:iam::${account}:root
```

In this example a Bucket resource is created in `MyAccount`. All Accounts that are part of the `ReadAccessAccountBinding` will be provided Get/List access to this bucket using a BucketPolicy. In this example the `ReadAccountAccountBinding` is expected to be supplied by a task file. the default specified in the template is an empty binding (no account will get access to the `Bucket` resource).

**Note that** as the default is an empty binding and therefore `EnumTargetAccounts` will generate an empty array it is necessary to only create the `BucketPolicy` if there is more than 0 accounts part of the `ReadAccountAccessBinding`. The function `Fn::TargetAccount` will return the number of accounts part of a binding.

A more complete example on how to set up cross account access to S3 Buckets can be found here: https://github.com/OlafConijn/AwsOrganizationFormation/blob/master/examples/templates/cross-account-bucket.yml

## In summary

In this article you will have learned about 3 features that the org-formation tool provides that can be used to set up and manage resources across your AWS Organization. This article was written on version `0.9.5` of org-formation. As the tool is actively developed and maintained, for the most recent version, example and documentation you can refer to the Github project page at: https://github.com/OlafConijn/AwsOrganizationFormation.

Feel free to engage, create issues, ask questions over slack, provide feedback and share your experiences.

Olaf
