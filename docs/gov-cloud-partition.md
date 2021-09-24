# Gov Cloud Partition
Certain use cases may require that you run your workloads in a AWS partition other than `aws` also known as the commercial partition.  While it is our intention to support all partitions (gov cloud, China, Germany) support has started for gov cloud. Below you can find examples of how to perform Org Formation commands in the context of gov cloud.

> **important**:  Each gov cloud account is tied to a commercial account for billing.  You cannot have a gov cloud account without a commercial account.  This means that Org Formation is required to managed both partitions simutaneously.  Org Formation does this by "mirroring" these accounts.  The `organization.yml` file looks the same as you would expect, with some slight differences.

``` yaml
OrganizationRoot:
    Type: OC::ORG::OrganizationRoot
    Properties:
        MirrorInGovCloud: True
        DefaultOrganizationAccessRoleName: OrganizationAccountAccessRole
```

The `MirrorInGovCloud` attribute on the `OC::ORG::OrganizationRoot` resource indicates to org formation that when accounts are created or modified to do so in both the commercial and gov cloud partitions.

``` yaml
TestAccount:
    Type: OC::ORG::Account
    Properties:
        AccountName: test
        RootEmail: email@example.com
        Alias: test-c
        GovCloudAlias: test-gc
```

> **note:** `Alias` and `GovCloudAlias` must be **different** values

The `GovCloudAlias` on the `OC::ORG::Account` resource type indicates the account alias for the gov cloud account.  To prevent confusion this alias should be different than the `Alias` attribute.

> **important**: Currently organizational units are **not** supported in gov cloud and cannot be present in your `organization.yml` file.

### ``org-formation init``

Creates a local organization formation file that contains all organization resources. Running this command will create an S3 Bucket (hence the region) in your account that contains a state file which is used to track differences when updating your resources.

``> org-formation init organization.yml --region us-east-1 --gov-cloud-profile <name_of_gov_cloud_master_role``  
**or**  
``> org-formation init organization.yml --region us-east-1 --gov-cloud-credentials``

A new attribute is required for org formation to work properly across partitions.  The `--gov-cloud-profile` or `--gov-cloud-credentials`attribute indicates where to find credentials for the gov cloud account.  You can either pass a named profile or org formation will look for credentials as environment variables (`GOV_AWS_ACCESS_KEY_ID` and `GOV_AWS_SECRET_ACCESS_KEY`).  When this command is execute you need to have terminal session with active AWS credentials to the commercial master account.

### ``org-formation update``

Updates organizational resources specified in templateFile.

``> org-formation update  org-formation update ./src/organization.yml --gov-cloud-profile <name_of_gov_cloud_master_role``  
**or**  
``> org-formation update  org-formation update ./src/organization.yml --gov-cloud-credentials``

Again, when running org-formation update a new attribute is required for org formation to have proper access to both the commercial and gov cloud partitions.  The Update command will "mirror" the organization on both sides of the partition.

**note**: There are org formation state files on both sides of the partition.  Meaning when you create an organization an s3 bucket is created in both commercial and gov cloud master accounts.

## Running Tasks
Tasks can only be ran on specific partitions (commercial or gov cloud).
   - To run commercial tasks:  
   `` > org-formation perform-tasks taskfile.yml [--profile my-aws-profile]``  

   - To run gov cloud tasks pass the `--gov-cloud` flag:  
   `` > org-formation perform-tasks ./src/_gov-cloud-tasks.yml --gov-cloud``
