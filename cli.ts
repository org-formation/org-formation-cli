#!/usr/bin/env node

import { CliProgram } from './cli-program';

const program = CliProgram.Create();

const args = process.argv;
// if (args.length === 2) {
//   args = args.concat('--help');
// } else if (program.commandNames.indexOf(args[2]) === -1) {
//   args = [args[0], args[1], '--help'];
// }

program.parse(args);
