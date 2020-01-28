

# Examples
<!-- @import "[TOC]" {cmd="toc" depthFrom=2 depthTo=6 orderedList=false} -->

<!-- code_chunk_output -->

- [budget alarms](#budget-alarms)
- [cloudtrail](#cloudtrail)
- [guardduty](#guardduty)
- [cross account bucket](#cross-account-bucket)
- [cross account role](#cross-account-role)
- [cross account role with alarm](#cross-account-role-with-alarm)
- [cross account secret](#cross-account-secret)
- [cross account lambda](#cross-account-lambda)
- [wildcard carts (2 regions)](#wild-card-carts-2-regions)

<!-- /code_chunk_output -->


## budget alarms

Basic example on how to create budget alarms based on tags that are defined on the account.

![budget alarms](img/budget-alarms.png)

[budget-alarms.yml](budget-alarms.yml)


## cloudtrail

Example on how to do a basic cloud trail implementation. Demonstrates cross account references

![cloudtrail](img/cloudtrail.png)

[cloudtrail.yml](cloudtrail.yml)



## guardduty

Example on how to do a basic guardduty implementation. Demonstrates cross account references / ForeachElement / DependsOnAccount

[guardduty.yml](guardduty.yml)

![guardduty](img/guardduty.png)


## subdomains

Example on how to provision route 53 subdomains for all accounts within your organization based on a tag and including a root hosted zone in the organization master account.

[subdomains.yml](subdomains.yml)

![subdomains](img/subdomains.png)




## cross account bucket

Reusable template to do cross account access to S3 bucket.

![cross-account-bucket](img/cross-account-bucket.png)

[cross-account-bucket.yml](cross-account-bucket.yml)


## cross account role

Reusable template to do cross account IAM roles.

![cross-account-role](img/cross-account-role.png)

[cross-account-role.yml](cross-account-role.yml)


## cross account role with alarm

Reusable template to do cross account IAM roles with an alarm (based on CloudTrail)

![cross-account-role-with-alarm](img/cross-account-role-with-alarm.png)

[cross-account-role-with-alarm.yml](cross-account-role-with-alarm.yml)


## cross account secret

Reusable template to do cross account secretsmanager secrets.

![cross-account-secret](img/cross-account-secret.png)

[cross-account-secret.yml](cross-account-secret.yml)


## cross account lambda

Reusable template to do cross account lambdas. Assumes the lambda is deployed by another means (serverless? SAM?)

![cross-account-lambda](img/cross-account-lambda.png)

[cross-account-lambda.yml](cross-account-lambda.yml)

## wildcard carts (2 regions)

Template that demonstrates provisioning wildcard certificates in both us-east-1 and another region while having the ARNs to these certicates stored locally in SSM.

![wildcard-certs](img/wildcard-certs.png)

[wildcard-certs.yml](wildcard-certs.yml)
