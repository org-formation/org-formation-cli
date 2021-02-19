# AWS Organization Formation

AWS Organization Formation is an Infrastructure as Code (IaC) tool for AWS Organizations.

## Features

AWS Organization Formation (also: ``org-formation``) has 3 main features:

1. Infrastructure as Code for AWS Organizations:
[![Infrastructure as Code for AWS Organizations](docs/img/feature-1-update-org.png)](docs/organization-resources.md)
[Organization resources reference](docs/organization-resources.md) | [Example organization file](examples/organization.yml) | [CLI Reference](docs/cli-reference.md)


&nbsp;

2. CloudFormation annotations to provision resources cross account:
[![CloudFormation annotations to provision resources cross account](docs/img/feature-2-update-stacks.png)](docs/cloudformation-resources.md)
[Annotated CloudFormation reference](docs/cloudformation-resources.md) | [Examples](examples/) | [CLI Reference](docs/cli-reference.md)



&nbsp;


3. Automation of account creation and resource provisioning:
[![Automation of account creation and resource provisioning](docs/img/feature-3-perform-tasks.png)](docs/task-files.md)
[Automation task file reference](docs/task-files.md) | [Example tasks file](examples/organization-tasks.yml) | [CLI Reference](docs/cli-reference.md)


Want more? here a [list of 50+ features](docs/features.pdf) 😎😎😎

## Installation
With [npm](https://npmjs.org/) installed, run
```
> npm install -g aws-organization-formation
```

You can now execute the command line program `org-formation`. try:

```
> org-formation --help
```

### Docker

If you choose, you can run org-formation in a docker container:

```sh
# Set the AWS_PROFILE environment variable and pass it to the container
> AWS_PROFILE=example
# Run the container
> docker run --rm -it -v $HOME/.aws:/root/.aws:ro -v $PWD:/workdir -w /workdir -e AWS_PROFILE orgformation/org-formation-cli
```

Optional: create an alias for the container:

```sh
> alias org-formation='docker run --rm -it -v $HOME/.aws:/root/.aws:ro -v $PWD:/workdir -w /workdir -e AWS_PROFILE orgformation/org-formation-cli'
```

## Getting started

💡Need help getting started? [Get some on slack!](https://join.slack.com/t/org-formation/shared_invite/enQtOTA5NjM3Mzc4ODUwLTMxZjYxYzljZTE5YWUzODE2MTNmYjM5NTY5Nzc3MzljNjVlZGQ1ODEzZDgyMWVkMDg3Mzk1ZjQ1ZjM4MDhlOGM)

📖How to set up AWS Organizations? [Off to a great start](./docs/articles/aws-organizations.md)

🎧 Hear about org-formation in [Real-World Serverless podcast #5](https://open.spotify.com/episode/0VPwObFeQ68oImfqW3lIge?si=VNluO9ZaTc-p3cpps6IBQg)

📺 See org-formation in [Mastering AWS Organizations with Infrastructure-As-Code](https://www.youtube.com/watch?v=mLAGHzidHJ0)


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

**Note**: If you prefer to set up CI/CD run ``org-formation init-pipeline`` instead. It will create a CodeCommit repository and CodePipeline that will update your organization upon every commit!

You can make changes to the file you generated and update your organization using the ``update`` command. Alternatively, you can run ``create-change-set`` and ``update-change-set``. Read more in the [cli reference](docs/cli-reference.md)

Once you got the hang of managing organization resources, use these organization resources to write smarter CloudFormation that allows you to provision resources across your organization. Read more [about managing resources across accounts](docs/cloudformation-resources.md).

## Why is this important?

Just like with the resources within your AWS Account, managing AWS Organization resources **as code** allows you to apply changes automatically, reducing manual work, inconsistencies and mistakes.

If you are considering to use an account vending machine (e.g. [AWS Control Tower](https://aws.amazon.com/controltower/)) to create and manage new accounts within your organization: Do realize that the account vending machine allows you to quickly create organization resources but only has limited facilities when it comes to updating and maintaining these resources.


## Questions and Answers

<details>
<summary>
My operation takes a long time to complete / is slow.
</summary>
&nbsp;

Especially if you have a lot of accounts this can happen.

An easy way to speed things up is by specifying the command-line argument `--max-concurrent-stacks 10` where 10 is the number of stacks to run in concurrently.

Another way to speed things up is to run tasks in parallel this can be done with the argument `--max-concurrent-tasks 10`. This, however, has the side-effect that the logging might be somewhat harder to relate to a specific task (as it might be out of order).

&nbsp;
</details>

<details>
<summary>
Is there a way around having to create new email accounts per account?
</summary>
&nbsp;

Every AWS account needs a unique root email address, there is no way around this...

What you **can do** is to check whether your mail server allows you to append a '+' (plus sign) and another secondary name to your account to create new unique email addresses.

Email to there addresses will end up in the mailbox assigned to the alias before the plus sign and this will still be considered a valid and unique email address when creating a new AWS Account.

**Example:**
If your email address is `name@gmail.com` you will receive email send to `name+awsaccount1@gmail.com` and `name+awsaccount2@gmail.com` to your inbox.

Mail servers that support this are gmail, aws workmail and hotmail.

&nbsp;
</details>

<details>
<summary>
How do i set up MFA for the account used by org-formation?
</summary>
&nbsp;

`Org-formation` needs high privilege access to your master account. If you run `org-formation` manually it is wise to set up MFA.

I assume you have credentials set up in `~/.aws/credentials` and this looks like (might well be called `default`):
``` ini
[org-formation]
aws_access_key_id = AKIAxxxxxxxxx
aws_secret_access_key = xxxxxxxxxxxxxxxxx
```

This allows org-formation to assume the IAM User that corresponds to the access key and secret using the option `--profile org-formation`.

To enforce MFA you need to do the following:
1) Assign an MFA device to the IAM User in the console.
2) Create a role in your master account that has high privileged access and enforces the use of MFA. We call this `MyOrgFormationRole`.
3) Create a profile that refers to the MyOrgFormation. We call this profile `org-formation-mfa`.
4) Test whether MFA has been setup correctly by running `org-formation describe-stacks --profile org-formation-mfa`.
5) If step #4 was successful you can strip the IAM user you use from permissions other than the once it needs to assume `MyOrgFormationRole`.

Code snippets below:

1) Creating the `MyOrgFormationRole` Role (step #2) - execute with CloudFormation
``` yaml
AWSTemplateFormatVersion: '2010-09-09'

Resources:
  MyOrgFormationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: MyOrgFormationRole
      ManagedPolicyArns:
      - 'arn:aws:iam::aws:policy/AdministratorAccess'
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
        - Effect: Allow
          Principal:
            AWS: !Sub 'arn:aws:iam::${AWS::AccountId}:root'
          Action: sts:AssumeRole
          Condition:
            Bool:
              aws:MultiFactorAuthPresent: 'true'
```

2) Creating the profile `org-formation-mfa` (step #3) put in your `~/.aws/config` file.
Replace `000000000000` with your master account id.
The value for `mfa_serial` needs to be the value you got when setting up MFA for your user

``` ini
[profile org-formation-mfa]
role_arn = arn:aws:iam::000000000000:role/MyOrgFormationRole
source_profile = org-formation
mfa_serial = arn:aws:iam::000000000000:mfa/my-user
```

3) Expected output when executing a command that requires MFA (step 4):

``` bash
\> org-formation describe-stacks --profile org-formation-mfa
👋 Enter MFA code for arn:aws:iam::000000000000:mfa/my-user:
XXXXXX # here you type in the  put the MFA code
{ ...regular output } # if successful the command will execute
```

4) The minimum set of permissions for your user
Replace `000000000000` with your master account id (or the complete ARN for your Role )

``` yaml
Sid: 'AssumeMFARole'
Action: 'sts:AssumeRole'
Effect: 'Allow'
Resource: 'arn:aws:iam::000000000000:role/MyOrgFormationRole'
```

Hope this helps

&nbsp;
</details>

<details>
<summary>
What is the password of the root user for newly created accounts?
</summary>
&nbsp;

Accounts that are created have a root user but **no password**.

You can create a password using the 'Forgot password' process using the root email.

**Note:** Once you have created a password and used it consider throwing the password away. You are not supposed to log in using root anyway and storing your password somewhere could only lead to losing it. As we just figured out above you didn't need it in the first place.

**Do bind** an MFA on your root user! Find info under the [IAM service section of the console](https://console.aws.amazon.com/iam/home?/security_credentials#/home)

**Needless to add?** don't use a virtual MFA on the same device that has access to the email account used as RootEmail... this reduces your 'multi-factor' authentication to a single factor 🤔🤣

&nbsp;
</details>

<details>
<summary>
What happens when I remove an account from the organization.yml?
</summary>
&nbsp;

If you remove an account from the organization it will not be deleted. Deleting accounts using API calls is not supported by AWS.

After running `update` the account that is removed from the organization will not be able to be part of organization bindings.

```
\> org-formation update ./examples/organization.yml --profile org-formation
OC::ORG::Account              | Development4Account           | Forget
OC::ORG::OrganizationalUnit   | DevelopmentOU                 | Detach Account (Development4Account)
OC::ORG::OrganizationalUnit   | DevelopmentOU                 | CommitHash
```

After running `update-stacks` any stack that was deployed to this account using org-formation will be deleted from the target account. Stacks that have been created by other means will not be affected.

Obviously: having a task file will do both `update` and `update-stacks` in the right sequence and you're done!

If you removed and account and want to re-add it:
Just add it back to the organization.yml. Make sure you run `update` and `update-stacks` (or `perform-tasks`) and your account will participate in all bindings and the stacks will be re-deployed to the account.

As long as the account was not deleted in full `org-formation` will identify it by the `RootEmail` (or `AccountId`) attribute in the organization.yml

&nbsp;
</details>


<details>
<summary>
What happens when I rename an account (AccountName attribute) in org-formation?
</summary>
&nbsp;

Renaming accounts is not possible using API's. You will have to log into the account as root to change the account name in AWS.

If you change the AccountName attribute in org-formation this will warn you about the above and will, when resolving references to the account, use the account name from the organization.yml file.

&nbsp;
</details>


<details>
<summary>
What happens when I rename an account (logical name) in org-formation?
</summary>
&nbsp;

The logical name, just like with CloudFormation is how you refer to the account from within your templates. The logical account is also used as an identifier within org-formation.

If you rename an account, by its logical name, org-formation will first notice that the resource by the old logical name has gone and `forget` it. Later it will discover the new same account by its new logical name and match it with the physical account that already exists in AWS. It will match the two thus completing the rename.

&nbsp;
</details>


<details>
<summary>
Why is XYZ not supported?
</summary>
&nbsp;

No reason other than not running into this use-case so far.

Really happy to implement this based on someone elses use-case.

&nbsp;
</details>




## More docs

- [Examples](examples/)
- [List of 50+ features](docs/features.pdf)
- [Managing AWS Organizations as code](docs/organization-resources.md)
- [Organization Annotated CloudFormation](docs/cloudformation-resources.md)
- [Automating deployments](docs/task-files.md)
- [Custom Account Creation Workflow](examples/automation/create-account/readme.md)
- [CLI reference](docs/cli-reference.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)

## Sponsors & collaborators

Special thanks to the following companies:


[![Stedi](./docs/img/stedi.png)](https://www.stedi.com)

[![Moneyou](./docs/img/moneyou.svg)](https://www.moneyou.nl)

[![ChainSlayer](./docs/img/chainslayer.png)](https://www.chainslayer.io/)

Special thanks to the following individuals:
- [Tjerk Stroband](https://github.com/tstroband)
- [Yan Cui](http://theburningmonk.com)
- [Eduardo Rodrigues](https://github.com/eduardomourar)
- [Rene Mulder](https://github.com/rene84)
