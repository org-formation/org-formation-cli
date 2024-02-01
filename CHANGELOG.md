# Changelog

All notable changes to aws organization formation will be documented in this file.

**BREAKING CHANGES**:
- v1.0.0: execution role under which org-formation is ran requires the ec2:describeRegions permission 

**version: 1.0.13**
- fix: cdk tasks use `--force` when deleting stacks
- chore: usage of AWS SDK v3 (upgrade from V2)
- fix: deleting stacks without explicit concurrency settings will default to settings passed to the CLI (instead of 1)

**version 1.0.11**
- feat: support MaxConcurrentTasks > 0 on update-cdk tasks
- feat: support IgnoreFileChanges on update-cdk, update-serverless.com and apply-tf tasks (allows the task to be skipped if certain files got changed)
- fix: stacks in UPDATE_ROLLBACK_FAILED wont get deleted when attempting to recover from a failed update
- feat: Control Tower (or any other account factory solution) support using the annotate-organization task

**version 1.0.9** / **version 1.0.10** (redeploy of 1.0.9)
- feat: support `--match` and `--dev` on print & validate commands
- feat: support serverless.com V3, by setting the `SLSVersion` attribute to `3` in the task file
- fix: allow sub-expression to be a `!ReadFile`, `!Cmd` or other expression

**version 1.0.8**
- feat: added Terraform support task support (task type: `apply-tf`)

**version 1.0.7**
- feat: allow a development role to be configured on the OrganizationRoot (DefaultDevelopmentBuildAccessRoleName) which will be used when running using `--dev`
- fix: STS defaults to regional STS which allows deployments to non-default aws regions.
- fix: support cloudformation language extensions: `Fn::ToJsonString` and `Fn::Length`
- fix: fail the build if a task gets deleted that has TerminationProtection set to true.

**version 1.0.6**
- fix: only prevent printing/ validating stacks if an account is added to organization.yml (not prevent printing if an OU got added)
- chore: better perf on update-organization task
- fix: explicitly retry on type registrations that return `DEPLOY_STAGE of status FAILED` 
- feat: allow nunjucks templating context to be passed to cli commands perform-tasks, print-tasks, validate-tasks, update & print-org
- feat: support disableRollback on update-stacks tasks
- feat: allow accounts to be excluded when performing any command (--exclude-accounts '112223344555,112223344555' )
- feat: specify bucket to be used for large template uploads (on validate-tasks, perform-tasks, validate-stacks and update-stacks)
- feat: support closing removed accounts form the organization specifying "CloseAccountsOnRemoval: true" on the OrganizationRoot in organization.yml
- fix: better defaults for the deploy-cdk task: added `--all --require-approval=never` to default deploy and destroy commands
- fix: allow matching a single task using `--match` taking a globPattern (e.g. `--match '**/MyTask'`) or the exact name of a task.

**version 1.0.5** (version contained packaging error, got unpublished)

**version 1.0.4**
- feat: allow `Fn::EnumTargetAccounts` to be used in combination with `${AccountId}`, `${AccountName}`, `${LogicalId}`, `${RootEmail}`, `${Alias}`, `${Tags.TAGNAME}`
- feat: dependsOnAccount support for govcloud
- feat: support for ExcludeOrganizationalUnit in organization binding
- fix: EMAIL_ALREADY_EXISTS when importing account using root email for govcloud
- feat: Nunjucks templating support on LocalFile contents of copy-to-s3 tasks
- feat: allow organization binding to be declared as a task-file parameter (Type: 'OrganizationBinding')
- feat: support comma-delimited CloudFormation parameter values
 
**version 1.0.3**
- fix: creating a new account doesnt properly display the new account id in the logs (displays [object Object] instead)

**version 1.0.2**
- feat: support top-level rules in template
- fix: honour taskRoleName when printing tasks

**version 1.0.1**
- fix: ExcludeOrganizationalUnit throws a validation error.
- fix: No targetId when attaching scp to root
- chore: update runtime deps

**version  1.0.0**
- feat: AWS GovCloud (US) support (using --partition flags). AWS organizations from the commercial partition will be mirrored to a non-commercial partition e.g. AWS GovCloud (US).
- fix: invalid CRC checksum on zipfile when running init-pipeline
- feat: support for up to 4000 AWS Accounts within an organization
- fix: caching of exported values, therefore improving performance and avoiding rate limiting errors 
- fix: template support for --print-tasks

**version 0.9.19**
- fix: unable to package the initial commit when running init-pipeline.

**version 0.9.18**

- feat: support ExcludeOrganizationalUnit in binding
- feat: support ServerSideEncryption in copy-to-s3 task
- fix: ensure password policy and alias don't get cleared on init/build
- fix: ensure concurrency settings are re-used when deleting tasks
- fix: add retry and backoff when reading the organization (e.g. using init)
- fix: strip dashes from account names when generating the logical names during init

**version 0.9.17**

- fix: allow templates without version attribute
- feat: support `!Ref AWS::Partition` in tasks file
- feat: allow yaml anchors to be declared in top level `Definitions` attribute
- feat: reduce 'not in update create completed' failures when creating new account (due to rate limiting)
- feat: TextTemplating support for organization.yml and task files
- feat: possibility to mix TextTemplating and bindings/expressions
- feat: stack tags
- fix: org-formation init to honor `--cross-account-role-name`

**version 0.9.16**

- fix: missing role in build account when running init-pipeline

**version 0.9.15**

- BREAKING CHANGE: when using OrgFormationBuild role, this role will be used and **must be present** in all accounts (also in the build account), more info [here](https://github.com/org-formation/org-formation-cli/blob/master/docs/0.9.15-permission-change.md)
- feat: support for `<<` (merge operator) in the organization.yml file. this allows for large organization.yml files to be split out (using `<<: Include ./dev-accounts.yml`)
- feat: better profile support added support for credential process and SSO
- feat: perform tasks will create a state bucket if bucket doesn't exist
- feat: added !Cmd function to execute and capture the output of any shell command
- feat: ofn alias to binary
- feat: init & init-pipeline commands use default region from profiles file.
- feat: support for nunjucks templating on CloudFormation templates
- fix: allow `!Ref CurrentAccount` and `!FindInMap` to be used together in a tasks file.
- fix: have init-pipeline create a pipeline that works with the main branch (as opposed to master)
- fix: allow for SAM templates with a globals section to deploy
- fix: set the default buildAccessRoleName for cdk and sls tasks
- fix: race condition deploying/validating/printing templates if update-organization task is placed in an include

**version 0.9.14**

- Support for moving the org-formation build process out of the master/management account in AWS
- Support for splitting up the CI/CD process (perform-tasks) into multiple
- Organization.yml file gets published to S3 and EventBridge after change (and successful perform-tasks).
- Support for centrally stored parameters using `!Include`.
- Optimized buildtime on organization.yml file changes.
- Added `CAPABILITY_AUTO_EXPAND` to support deploying SAM.
- Templates with CloudFormation resolve expressions will get redeployed (as the outcome will be evaluated by Cfn).
- Numerous bugfixes and small improvements.

**version 0.9.13**

- Added a new command: `print-tasks`, which will generate all cloudformation templates and write to disk.
- Added `zip-before-put` support to `copy-to-s3` task.
- Added support for `!ReadFile` and `!JsonString` inside CloudFormation templates.
- Added functions `!MD5Dir` and `!MD5File`, which can be used in both task files and cloudformation.
- Added psuedo parameter `ORG::StateBucketName`.
- Optimized build time by locally skipping resource providers if task did not change.
- Updated codebuild image used to create new pipelines with to standard:4.0.
  Note: If you are running a pipeline generated by org-formation, you might want to update the build image for faster provisioning time!

**version 0.9.12**

- Allow failure tolerance to be set to 0 on validate-tasks command (allows CI/CD processes to fail on validation)
- Added support for `Mappings` section / `!FindInMap` / `!Select` for task files.
- Added functions `!MD5` / `!ReadFile` that can be used in task files.
- Added function `!JsonString` that can be used in task files.
- Added support for `!Ref OrganizationRoot` (and other types) in task files.
- Fixed bug on `org-formation init` where tags on the MasterAccount where not added to generated template.
- Updating stacks that have state `ROLLBACK_FAILED` will be retried.
- Support for large (> 512000 byte) templates

**version 0.9.11**

- Added pseudo parameter `ORG::PrincipalOrgID` (in tasks file).
- Improved parsing of attributes in task files.
- AWSAccount can be used as alias for `CurrentAccount` in task file expressions.
- Added support for cross account references on `VPCEndpoint.DnsEntries`.

**version 0.9.10**

- Fixed bug where `register-type` tasks did not properly register execution role.

**version 0.9.8**

- Fixed bug with variables in `CustomDeployCommand` for SLS tasks.
- Improved validation and error messages for `CustomDeployCommand` and `CustomRemoveCommand`.
- Implemented `register-type` task that allows for resource provider types to be deployed using org-formation
- Support for `.org-formationrc` to configure `profile`, `configurationFile`, `stateBucketName` & `stateObject` options

**version 0.9.7**

- Increased buffer size for tasks ran on the console (update-sls and update-cdk)
- Fixed bug with OU structures that go three levels deep and/or multiple times the same ou name
- Added Support for `!Join` expressions in task files
- Fixed bug in Password Policy validation (Thanks Ralf vd Z)
- Added support for `--organization-file` option on `print-stacks` command
- Init command adds RootEmail to MasterAccount in generated template (Thanks @craighurley)
- Fixed bug where `!CopyValue` causes process to hang
- CDK will have CDK_DEPLOY_ACCOUNT and CDK_DEPLOY_REGION env variables set (Thanks @rehos)

**version 0.9.6**

- Fixed issue where `perform-task` parameters are passed to `update-stacks` task when no parameters where specified on task.
- Fixed issue managing state for plugins (`copy-to-s3`, `update-cdk`, `update-serverless`) that would be included with the same logical name.
- Allow `update-organization` task to be skipped without skipping all other tasks in file
- Allow `Skip` task to be overwritten in dependent tasks
- Force deployment of tasks by setting `ForceDeploy` attribute to true on command line, include task or task
- Override verbose logging of tasks by setting `LogVerbose` attribute to true on include task or task
- Have CodePipeline created by `init-pipeline` command 'poll for updates'
- Allow for custom OrganizationAccountAccessRole name per `Account` or per `OrganizationRoot`
- Added `--cross-account-role-name` flag to `init` and `init-pipeline` commands to initialize organizations that use a different name for the cross account access role.
- Fixed a bug that caused support level (e.g. enterprise) to not be updated when account got create with a support level attribute
- Improved suggestions on how to clean up resources removed from task file (added options like --profile)
- Fixed an issue where perform tasks threw an circular dependency error but instead the graph for failed tasks was too long.

**version 0.9.5**

- Added `StackPolicy` attribute to update-stacks tasks
- Added `UpdateProtection` attribute to update-stacks tasks and update stacks command.
- Added `Skip` attribute to any task (will skip task execution but continue, also with dependent tasks)
- Improved logging
- Added Parameter support to tasks file:
  -- Parameters can be declared in `Parameters` section
  -- Parameters can be used in `!Ref` and `!Sub` or as part of other expressions
- Added `!CopyValue` function to tasks file which can be used to reference to a stacks output.
- Added parameter support to CDK tasks
- Added parameter support to SLS tasks
- Improved profile configuration support.

**version 0.9.4**

- Added update-cdk task type to perform-tasks to support deployment of cdk workloads
- Added update-serverless.com task type to perform-tasks to support deployment of serverless.com workloads
- Added copy-to-s3 task type to perform-tasks to support uploading files to S3 as part of a build pipeline
- Added --organization-file to perform-tasks and validate-tasks command, can be used to specify the organization to be used when evaluating bindings (without having an update-organization task)
- Added TaskRoleName to update-stacks, update-serverless.com & copy-to-s3 tasks to support custom role for cross account access
- Added CloudFormationRoleName to update-stacks to pass specific role to CloudFormation

**version 0.9.3**

- Added flag --perform-cleanup to perform-tasks to automatically delete stacks removed from tasks file
- Added support for moving master account to OU
- Added support for multiple accounts that have the same account name

**version 0.9.2**

- Fixed issue with init-pipeline failing due to wrong option on codebuild script

**version 0.9.1**

- Added Support for expanding EnumTargetAccounts and EnumTargetRegions inside array
- Added Support for modeling nested Organizational Units
- OU bindings will include nested OU's
- Fixed issue with failed stacks tolerance on update-stacks
- Added option (--no-color) to disable colorization of log messages.
- Clear error message when generating organization.yaml for org with master account inside OU

**version 0.0.76**

- Fixed issue with validation of commandline input pararameters

**version 0.0.75**

- Added additional input validation

**version 0.0.74**

- Added support for further extending the account creation using CloudWatch / EventBridge events. See example: https://github.com/OlafConijn/AwsOrganizationFormation/tree/master/examples/automation/create-account

**version 0.0.73**

- Changed the default for max concurrent stacks (within a task, update or delete-stacks) to 1
- Added `--max-concurrent-stacks` and `--failed-stacks-tolerance` options
- Added attributes to update-stacks task to modify values for max-concurrancy and failure tolerance.
- When a tasks depends on a failed task it will be skipped automatically
- Added red to errors and yellow warnings to make 'm stand out more

**version 0.0.72**

- Fixed inconsistency in function naming scheme: using Fn:TargetCount will log a warning. Fn::TargetCount (2 colons) will not.

**version 0.0.71**

- Added SupportLevel attribute to accounts, which can be used to set the support subscription level (enterprise, business or developer) for the account.

**version 0.0.70**

- Modified init-pipeline command so it will include the template for codecommit/build/pipeline in the initial commit.
- Added descriptive error when !Ref on parameter.ExportAccountId cannot be resolved.
- Fixed bug where changing the logical name of MasterAccount resulted in invalid state.
- Changed the logical name of generated Foreach resources. Also added a very specific error with help how to resolve adverse effects of this on guardduty templates.

**version 0.0.69**

- Added --stack-trace flag to print stack traces for errors. stacktraces are now hidden by default.

**version 0.0.68**

- Added support for passing !Ref account in update-stacks parameters (tasks file).
- Added validation on the tasks in tasks file: top level file must have exactly 1 update-organization task
- Added validation on the tasks in tasks file: no 2 update-stacks tasks can have the same stackName

**version 0.0.67**

- Added support for empty/null bindings.
- Added Fn:TargetCount function which returns the amount of target for a binding. Can be used in Conditions, e.g: CreateResoruce: !Not [ !Equals [ Fn:TargetCount MyBinding, 0 ] ]

**version 0.0.65**

- Fixed issue where account creation had to be retried after timing issue accessing the account for the first time.
- When calling org-formation without args it will display help.

**version 0.0.64**

- Improved logic to select resource in cross target !Ref. If target resource exists in same account but different region AWSAccount.Resources.LogicalResourceId can now be used to refer to resource in different region.

**version 0.0.63**

- Fixed issue when deleting stacks state wasnt updated properly.

**version 0.0.62**

- Fixed issue with execute change set CLI command

**version 0.0.61**

- Added quite a bit of validation logic (notably to OrganizationalBindings and tasks)

**version 0.0.60**

- Ranamed Foreach to ForeachElement for resource foreach (old attribute logs warning)

**version 0.0.59**

- Ranamed OrganizationBinding to DefaultOrganizationBinding in template (old attribute logs warning)
- Ranamed OrganizationBindingRegion to DefaultOrganizationBindingRegion in template (old attribute logs warning)
- Ranamed OrganizationBinding to DefaultOrganizationBinding in update-stack tasks (old attribute logs warning)
- Ranamed OrganizationBindingRegion to DefaultOrganizationBindingRegion in update-stack tasks (old attribute logs warning)

**version 0.0.58**

- Support for cross account dependencies with conditions (condition gets copied to export)

**version 0.0.56**

- Support for qouted expressions in EnumTargetRegions and EnumTargetAccounts, e.g. Fn::EnumTargetAccounts RoleAccountBinding 'arn:aws:iam::${account}:role/DeveloperRole'
- Support for adding OrganizationBindings in update-stack tasks.

**version 0.0.55**

- Support for toplevel OrganizationBindings section to list organization bindings
- Changed EnumTargetAccounts and EnumTargetRegions to only work with organization bindings from OrganizationBindings section

**version 0.0.54**

- Fixed issue with explicit cross account !Ref and !GetAtt to local account (e.g. !GetAtt AWSAccount.Resources.Topic.arn)

**version 0.0.53**

- Made --stack-name option optional on validate-stack and print-stack.
- Added --parameters option to print-stacks command. Doesnt really do anything but allows you to use the same options on validate-stack and print-stack.

**version 0.0.52**

- Added --parameters option to validate-stacks command.

**version 0.0.51**

- When running perform-tasks, having an update-organization task is now required. The organization file will be re-used and must be consistent with other tasks.

**version 0.0.50**

- Fixed a bug where cross account export values that were resolved where re-used on multiple target parameters

**version 0.0.49**

- Added validate tasks command (org-formation validate-tasks <task-file>)

**version 0.0.48**

- Added validate stacks command (org-formation validate-stacks <template-file>)
- Init-pipeline now reuses state bucket if already present.

**version 0.0.47**

- Fixed an issue where stacks wouldnt be able to get deleted after the account was closed. Stacks will now be forgotten if deletion fails.
