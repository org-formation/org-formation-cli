#!/usr/bin/env node

import { createChangeSet, deleteAccountStacks, describeAccountStacks, executeChangeSet, generateTemplate, updateAccountResources, updateTemplate } from './index';

import program from 'commander';
const knownCommands = ['init', 'update', 'update-accounts', 'delete-stacks', 'describe-stacks', 'execute-change-set', '--version', '-V'];

let pjson;
try {
  pjson = require('../package.json');
 } catch (err) {
  pjson = require('./package.json');
 }
program
  .version(pjson.version)
  .description('aws organization formation');

program
  .command('init <outFile>')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .option('--state-bucket-region [state-bucket-region]', 'region used to created state-bucket in')
  .description('generate template & initialize organization')
  .action(async (outFile, cmd) => await generateTemplate(outFile, cmd));

program
  .command('update <templateFile>')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('update organization')
  .action(async (templateFile, cmd) => await updateTemplate(templateFile, cmd));

program
  .command('update-accounts <templateFile>')
  .option('--stack-name <stack-name>', 'name of the cloudformation stack used to update resources')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('update cloudformation resources in accounts')
  .action(async (templateFile, cmd) => await updateAccountResources(templateFile, cmd));

program
  .command('delete-stacks <stack-name>')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('removes all stacks deployed to accounts using org-formation')
  .action(async (stackName, cmd) => await deleteAccountStacks(stackName, cmd));

program
  .command('describe-stacks')
  .option('--stack-name [stack-name]', 'if specified only returns stacks of stack-name')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('list all stacks deployed to accounts using org-formation')
  .action(async (cmd) => await describeAccountStacks(cmd));

program
  .command('create-change-set <templateFile>')
  .option('--profile [profile]', 'aws profile to use')
  .option('--change-set-name [change-set-name]', 'change set name')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('create change set that can be reviewed and executed later')
  .action(async (templateFile, cmd) => await createChangeSet(templateFile, cmd));

program
  .command('execute-change-set <change-set-name>')
  .option('--profile [profile]', 'aws profile to use')
  .option('--state-bucket-name [state-bucket-name]', 'bucket name that contains state file', 'organization-formation-${AWS::AccountId}')
  .option('--state-object [state-object]', 'key for object used to store state', 'state.json')
  .description('execute previously created change set')
  .action(async (templateFile, cmd) => await executeChangeSet(templateFile, cmd));

let args = process.argv;
if (args.length === 2) {
  args = args.concat('--help');
} else if (knownCommands.indexOf(args[2]) === -1) {
  args = [args[0], args[1], '--help'];
}

program.parse(args);
