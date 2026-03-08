# AWS European Sovereign Cloud (EUSC) Partition

The AWS European Sovereign Cloud (EUSC) is a new AWS partition designed to meet the digital sovereignty requirements of European customers. Similar to GovCloud, EUSC operates as a separate partition with its own domain and regions.

> **important**: Like GovCloud, EUSC accounts may be tied to commercial accounts for billing purposes. This means that Org Formation may need to manage both partitions simultaneously. Org Formation does this by "mirroring" these accounts. The `organization.yml` file looks the same as you would expect, with some slight differences.

## Key Characteristics

- **Partition Name**: `aws-eusc`
- **Domain**: `amazonaws.eu` (instead of `amazonaws.com`)
- **Initial Region**: `eusc-de-east-1` (Brandenburg, Germany)
- **ARN Format**: `arn:aws-eusc:service:region:account-id:resource`

## Organization Configuration

To enable partition mirroring for EUSC, configure your `organization.yml` with the `MirrorInPartition` attribute:

```yaml
OrganizationRoot:
  Type: OC::ORG::OrganizationRoot
  Properties:
    MirrorInPartition: True
    DefaultOrganizationAccessRoleName: OrganizationAccountAccessRole
```

The `MirrorInPartition` attribute on the `OC::ORG::OrganizationRoot` resource indicates to org formation that when accounts are created or modified to do so in both the commercial and aws-eusc partitions. Currently this is a boolean value, however, in the future it should indicate which partition to mirror in.

## Account Configuration

When creating accounts that exist in both partitions, specify different aliases:

```yaml
EUSCAccount:
  Type: OC::ORG::Account
  Properties:
    AccountName: EUSC Test Account
    RootEmail: email@example.com
    Alias: test-commercial
    PartitionAlias: test-eusc
```

> **note:** `Alias` and `PartitionAlias` must be **different** values

The `PartitionAlias` attribute on the `OC::ORG::Account` resource type indicates the account alias for the mirrored partition account. To prevent confusion this alias should be different than the `Alias` attribute.

> **important**: Currently organizational units are **not** supported in non-commercial partition accounts and cannot be present in your `organization.yml` if you are mirroring across a different partition.

## Authentication

Org Formation supports multiple methods for authenticating to the EUSC partition:

### Option 1: Environment Variables

```bash
export EUSC_AWS_ACCESS_KEY_ID=your-access-key
export EUSC_AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Option 2: AWS Profile

Use the `--partition-profile` flag to specify a named AWS profile configured for EUSC access.

## Commands

### `org-formation init`

Creates a local organization formation file that contains all organization resources. Running this command will create an S3 Bucket (hence the region) in your account that contains a state file which is used to track differences when updating your resources.

```bash
org-formation init organization.yml \
  --region eu-central-1 \
  --partition-region eusc-de-east-1 \
  --partition-profile eusc-profile
```

Or with environment variables:

```bash
org-formation init organization.yml \
  --region eu-central-1 \
  --partition-region eusc-de-east-1 \
  --partition-keys
```

A few new attributes are required for org formation to work properly across partitions:
- `--partition-region` string indicating which region to target in the partition. For EUSC, use `eusc-de-east-1`.
- `--partition-profile` is an optional string argument indicating where org formation can find credentials to access the partition.
- `--partition-keys` is an optional boolean argument indicating org formation to look for partition credentials as environment variables (`EUSC_AWS_ACCESS_KEY_ID` and `EUSC_AWS_SECRET_ACCESS_KEY`).

> **important**: This command must be executed from a terminal session with active AWS credentials to the commercial management account. One of the `--partition-profile` or `--partition-keys` arguments must be passed.

### `org-formation update`

Updates organizational resources specified in templateFile.

```bash
org-formation update organization.yml \
  --partition-region eusc-de-east-1 \
  --partition-profile eusc-profile
```

Again, when running org-formation update partition arguments are required for org formation to have proper access to both the commercial and mirrored partition. The Update command will "mirror" the organization on both sides of the partition.

> **note**: There are org formation state files on both sides of the partition. Meaning when you create an organization an s3 bucket is created in both commercial and EUSC master accounts.

## Running Tasks

Tasks can only be ran on specific partitions (commercial or mirrored partition i.e. aws-eusc).

**Commercial partition tasks:**
```bash
org-formation perform-tasks commercial-tasks.yml --profile my-aws-profile
```

**EUSC partition tasks:**
```bash
org-formation perform-tasks eusc-tasks.yml \
  --is-partition \
  --partition-region eusc-de-east-1 \
  --partition-profile eusc-profile
```

> **note**: Currently `update-organization` tasks types are not supported within your task files.

## Important Considerations

1. **State Files**: Org Formation creates separate S3 buckets and state files in both the commercial and EUSC partitions.

2. **Organizational Units**: Currently, organizational units are not supported in non-commercial partition accounts and cannot be present in your `organization.yml` if you are mirroring across partitions.

3. **Service Availability**: Not all AWS services are available in the EUSC partition. Verify service availability before deploying resources.

4. **Domain Differences**: The EUSC partition uses `amazonaws.eu` instead of `amazonaws.com` for service endpoints and S3 URLs.

5. **Region Availability**: Currently, only `eusc-de-east-1` is available in the EUSC partition. Additional regions may be added in the future.

## CloudFormation Templates

When writing CloudFormation templates that need to work across partitions, use the `AWS::Partition` pseudo-parameter:

```yaml
Resources:
  MyRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: !Sub 'lambda.${AWS::Partition}.amazonaws.eu'
            Action: sts:AssumeRole
```

Or use the `ORG::IsPartition` parameter provided by Org Formation:

```yaml
Conditions:
  IsEUSC: !Ref ORG::IsPartition

Resources:
  MyBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !If 
        - IsEUSC
        - my-eusc-bucket
        - my-commercial-bucket
```

## Troubleshooting

### Authentication Issues

If you encounter authentication errors:

1. Verify your credentials are correctly set in environment variables or AWS profile
2. Ensure the profile or credentials have access to the EUSC partition
3. Check that `--partition-region` is set to `eusc-de-east-1`

### Service Endpoint Issues

If services fail to connect:

1. Verify the service is available in the EUSC partition
2. Check that the correct domain (`amazonaws.eu`) is being used
3. Ensure the region `eusc-de-east-1` is specified correctly

## See Also

- [GovCloud Partition Documentation](./us-govcloud-partition.md)
- [Task Files Documentation](./task-files.md)
- [Organization Resources](./organization-resources.md)
