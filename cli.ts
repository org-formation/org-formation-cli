#!/usr/bin/env node

import { CliProgram } from './cli-program';

const program = CliProgram.Create();
const args = process.argv;
program.parse(args);

if (process.argv.length < 3) {
    program.help();
  }
