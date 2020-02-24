
# ``org-formation`` cli reference

In general: ``org-formation`` needs to be ran in the context of the organization master account. The IAM account needs to be broadly provisioned (happy to specify what in more detail)

Typing ``help`` after any command in the commandline will print documentation.

- [org-formation cli reference](#org-formation-cli-reference)
  - [Operations on organization resources](#operations-on-organization-resources)
    - [org-formation init](#org-formation-init)
    - [org-formation init-pipeline](#org-formation-init-pipeline)
    - [org-formation update](#org-formation-update)
    - [org-formation create-change-set](#org-formation-create-change-set)
    - [org-formation execute-change-set](#org-formation-execute-change-set)
  - [Operations on stacks](#operations-on-stacks)
    - [org-formation update-stacks](#org-formation-update-stacks)
    - [org-formation validate-stacks](#org-formation-validate-stacks)
    - [org-formation print-stacks](#org-formation-print-stacks)
    - [org-formation describe-stacks](#org-formation-describe-stacks)
    - [org-formation delete-stacks](#org-formation-delete-stacks)
  - [Operations on task files](#operations-on-task-files)
    - [org-formation perform-tasks](#org-formation-perform-tasks)
    - [org-formation validate-tasks](#org-formation-validate-tasks)
  - [Global options](#global-options)


## Operations on organization resources

### ``org-formation init``

Creates a local organization formation file that contains all organization resources. Runnning this command will create an S3 Bucket (hence the region) in your account that contains a state file which is used to track differences when updating your resources.

``> org-formation init --region us-east-1``

**note**: at any time you should be able to delete the state bucket and start over using the init command above.

|option|default|description|
|---|---|---|
|<nobr>--region</nobr>| none | The ``--region`` used to create the S3 buket used to store state|

### ``org-formation init-pipeline``

Creates an organization as done using the init command as well as default CodeCommit, CodeBuild and CodePipeline resources. The initial commit will contain the organization file generated for your organization as well as a default [tasks-file](docs/../task-files.md).

``> org-formation init-pipeline --region us-east-1``

**note**: at any time you should be able to run this command and start using the pipeline.

|option|default|description|
|---|---|---|
|<nobr>--region</nobr>| none | The ``--region`` used to create the AWS resources|
|<nobr>--stack-name</nobr> | ``organization-formation-build``| The name of the stack used to create the CodeCommit, CodeBuild and CodePipeline resources.|
|<nobr>--resource-prefix</nobr> |``orgformation-``| A prefix used for the CodeBuild and CodePipeline resources.|
|<nobr>--repository-name</nobr> |``organization-formation``| Name of the CodeCommit resource that will host the org-formation files.|


### ``org-formation update``

Updates organizational resources specificied in *templateFile*.

``> org-formation update organization.yml``


### ``org-formation create-change-set``

Creates a changeset that can be reviewed and later applied for changes in  *templateFile*.

``> org-formation create-change-set organization.yml``

output will contain the changeset as well as the changeset name.

|option|default|description|
|---|---|---|
|<nobr>--change-set-name</nobr> | *random value* | Name of the changeset that can later be used to apply changes.|


### ``org-formation execute-change-set``

Execute a changeset by name of  *changeSetName*.

``> org-formation execute-change-set change-set-name``

## Operations on stacks

### ``org-formation update-stacks``

Will deploy CloudFormation resources specified in *templateFile*.

``> org-formation update-stacks template.yml --stack-name my-stack ``

|option|default|description|
|---|---|---|
|<nobr>--stack-name</nobr> | none | **required** <br/>The stack name used to deploy cloudformation resources|
|<nobr>--parameters</nobr> | none | parameters that need to be passed to the cloudformation template.|
|<nobr>--termination-protection</nobr> | false | If specified the stack will be created with termination protection.|
|<nobr>--max-concurrent-stacks</nobr> | 1 | Maximum number of stacks to be updated concurrently |
|<nobr>--failed-stacks-tolerance</nobr> | 0 | The number of failed stacks after which execution stops|

paramters can be passed in a similar fashion cloudformmation parameters are passed:
``> org-formation update-stacks template.yml --stack-name my-stack --parameters ParameterKey=Param1,ParameterValue=Val1 ParameterKey=Param2,ParameterValue=Val2``

or the somewhat more simple fashion:
``> org-formation update-stacks template.yml --stack-name my-stack --parameters Param1=Val1 Param2=Val2``


### ``org-formation validate-stacks``

validates the cloudformation templates that will be generated based on *templateFile*.

``> org-formation validate-stacks template.yml --stack-name my-stack ``

|option|default|description|
|---|---|---|
|<nobr>--stack-name</nobr> | 'validation' | The stack name used to deploy cloudformation resources (used in e.g. generated names for output)|
|<nobr>--parameters</nobr> | none | parameters that need to be passed to the cloudformation template.|


paramters can be passed in a similar fashion cloudformmation parameters are passed:
``> org-formation validate-stacks template.yml --stack-name my-stack --parameters ParameterKey=Param1,ParameterValue=Val1 ParameterKey=Param2,ParameterValue=Val2``

or the somewhat more simple fashion:
``> org-formation validate-stacks template.yml --stack-name my-stack --parameters Param1=Val1 Param2=Val2``


### ``org-formation print-stacks``

Will print out CloudFormation templates generated based on *templateFile*.

``> org-formation update-stacks template.yml --stack-name my-stack ``

|option|default|description|
|---|---|---|
|<nobr>--stack-name</nobr> | 'print' | The stack name used to deploy cloudformation resources (used in e.g. generated names for output)|
|<nobr>--parameters</nobr> | none | parameters that need to be passed to the cloudformation template.|


### ``org-formation describe-stacks``

Lists all stacks deployed to accounts using org-formation

``> org-formation describe-stacks``


|option|default|description|
|---|---|---|
|<nobr>--stackName</nobr> | none| If specified will limit the output to changeset with specified stack name|

``> org-formation execute-change-set change-set-name``


### ``org-formation delete-stacks``

Will delete all stacks of name *stackName* that have been deployed using org-formation.

``> org-formation delete-stacks stackName``

|option|default|description|
|---|---|---|
|<nobr>--max-concurrent-stacks</nobr> | 1 | Maximum number of stacks to be deleted concurrently |
|<nobr>--failed-stacks-tolerance</nobr> | 0 | The number of failed stacks after which execution stops|

**Note**: Want to review the stacks that will be deleted? use
[``describe-stacks``](#command-org-formation-describe-stacks)


## Operations on task files

### ``org-formation perform-tasks``

Will perform tasks from *tasksFile*.

``> org-formation perform-tasks tasks.yml ``

|option|default|description|
|---|---|---|
|<nobr>--max-concurrent-tasks</nobr> | 1 | Maximum number of tasks to be executed concurrently|
|<nobr>--failed-tasks-tolerance</nobr> | 0 | The number of failed tasks after which execution stops|
|<nobr>--max-concurrent-stacks</nobr> | 1 | Maximum number of stacks (within a task) to be executed concurrently |
|<nobr>--failed-stacks-tolerance</nobr> | 0 | The number of failed stacks (within a task) after which execution stops|


### ``org-formation validate-tasks``

Will validate the *tasks-file*, including configured tasks.

``> org-formation validate-tasks tasks.yml ``

## Global options

|option|default|description|
|---|---|---|
|<nobr>--profile</nobr> | *none* |The ``--profile`` option works just like the ``--profile`` option in the AWS cli. If no profile is specified it uses the default profile from your ``~/.aws/config`` file|
|<nobr>--state-bucket-name</nobr> |  ``organization-formation-${AWS::AccountId}`` | The ``--state-bucket-name`` option allows you to specify which S3 Bucket state needs to be stored. The name may contain ``${AWS::AccountId}``.|
|<nobr>--state-object</nobr> |  ``state.json`` | The ``--state-object`` option allows you to specify which S3 object state needs to be stored in.|
|<nobr>--no-color</nobr> |  | the `--no-color` option will toggle off colorization of log files.|
|<nobr>--print-stack</nobr> |   | the `--print-stack` option will log stack traces for errors that occur.|
|<nobr>--verbose</nobr> |   | the `--verbose` option will log debug level information.|
