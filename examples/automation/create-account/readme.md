# Custom Account Creation Workflow

Example [serverless.com](http://www.serverless.com) project that will use StepFunctions send an email after account is created. This is intended as an example do demonstrate how to automate and extend the account creation process.

Custom account creation workflows are implemented using a CloudWatch/EventBridge rule. Use the following event pattern to subscribe to `AccountCreated` events (must be `us-east-1`)

``` yaml
 EventPattern:
    source:
    - oc.org-formation
    detail:
    eventName:
        - AccountCreated
```

**Note** that currently events are published in the `us-east-1` region. If you would like events to be raised in a different region, please raise a ticket: https://github.com/OlafConijn/AwsOrganizationFormation/issues

In your organization you might want to do something a lot less manual: automatically create a ticket, update a wiki or perform tasks in the created account. Maybe integrate a library like [https://github.com/sentialabs/coto](https://github.com/sentialabs/coto)?

Overview

![account-creation](../../img/account-creation.png)
