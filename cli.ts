#!/usr/bin/env node

import { CliProgram } from './cli-program';

const joinParameterArguments = (argv: string[]): string[] => {
    const result = [];
    let passedFirstArg = false;
    let currentOption = '';
    for (const arg of argv) {
        const isOption = arg.startsWith('--');
        if (!passedFirstArg && !isOption) {
            result.push(arg);
            continue;
        }
        if (!passedFirstArg && isOption) {
            result.push(arg);
            passedFirstArg = true;
            continue;
        }
        if (passedFirstArg && !isOption) {
            currentOption += arg + ' ';
            continue;
        }
        if (passedFirstArg && isOption) {
            if (currentOption !== '') {
                result.push(currentOption.trimRight());
                currentOption = '';
            }
            result.push(arg);
            continue;
        }
    }
    if (currentOption !== '') {
        result.push(currentOption.trimRight());
    }
    return result;
}

const program = CliProgram.Create();
const args = joinParameterArguments(process.argv);
program.parse(args);

if (process.argv.lastIndexOf('help') === process.argv.length - 1) {
    program.help();
} else if (process.argv.length < 3) {
    program.help();
}
