# Changelog
All notable changes to aws organization formation will be documented in this file.

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
