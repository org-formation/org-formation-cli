import { Command, Option } from "commander";
import { PrintChangeSetCommand } from "~commands/print-changeset";

describe('when creating print change set command', () => {
    let command: PrintChangeSetCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new PrintChangeSetCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('print change set command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('print-change-set');
    });

    test('print change set command has description', () => {
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.description()).toBeDefined();
    });

    test('command has required output parameter with default', () => {
        const opts: Option[] = subCommanderCommand.options;
        const stackNameOpt = opts.find((x) => x.long === '--output');
        expect(stackNameOpt).toBeDefined();
        expect(stackNameOpt.required).toBeTruthy();
        expect(subCommanderCommand.output).toBe('yaml');
    });
});