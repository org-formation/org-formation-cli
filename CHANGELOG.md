# Changelog
All notable changes to aws organization formation will be documented in this file.

**version 0.0.50**
- Fixed a bug where cross account export values that were resolved where re-used on multiple target parameters

**version 0.0.49**
- Added validate tasks command (org-formation validate-tasks <task-file>)

**version 0.0.48**
- Added validate stacks command (org-formation validate-stacks <template-file>)
- Init-pipeline now reuses state bucket if already present.

**version 0.0.47**
- Fixed an issue where stacks wouldnt be able to get deleted after the account was closed. Stacks will now be forgotten if deletion fails.
