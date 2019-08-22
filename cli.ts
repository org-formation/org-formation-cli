#!/usr/bin/env node

import { generateTemplate, updateTemplate } from './index';

const program = require('commander');

program
  .version('0.0.1')
  .description('aws organization formation');

program
  .command('generate-template <outFile>')
  .option('--profile <profile>', 'aws profile')
  .description('generate template')
  .action(async (outFile, cmd) => await generateTemplate(outFile, cmd));

program
  .command('update-template <templateFile>')
  .option('--profile <profile>', 'aws profile')
  .description('update organization')
  .action(async (templateFile, cmd) => await updateTemplate(templateFile, cmd));

let args = process.argv;
if (args.length === 2) {
  args = args.concat('--help');
}

program.parse(args);
