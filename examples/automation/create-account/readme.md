# Account creation process automation example

Example [serverless.org](http://www.serverless.org) project that will use StepFunctions send an email after account is created. This is intended as an example do demonstrate how to automate and extend the account creation process.

In your organization you might want to do something a lot less manual: automatically create a ticket, update a wiki or perform tasks in the created account. Maybe integrate a library like [https://github.com/sentialabs/coto](https://github.com/sentialabs/coto)

**Note** that currently events are published in the `us-east-1` region. If you would like events to be raised in a different region, please raise a ticket: https://github.com/OlafConijn/AwsOrganizationFormation/issues

Overview of the solution

![account-creation](../../img/account-creation.png)
