import { Command, Option } from "commander";
import Sinon = require("sinon");
import { PrintTasksCommand } from "~commands/print-tasks";

describe('when creating print tasks command', () => {
    let command: PrintTasksCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new PrintTasksCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('print tasks command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('print-tasks');
    });

    test('print tasks command has description', () => {
       expect(subCommanderCommand).toBeDefined();
       expect(subCommanderCommand.description()).toBeDefined();
    });

    test('command has required output path parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output-path');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.outputPath).toBe('./.printed-stacks/');
    });

    test('command has required output parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.output).toBe('yaml');
    });

    test('command has required output parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output-cross-account-exports');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.outputCrossAccountExports).toBe(false);
    });
});