import { Command, Option } from "commander";
import { PrintOrganizationCommand } from "~commands/print-org";

describe('when creating print tasks command', () => {
    let command: PrintOrganizationCommand;
    let commanderCommand: Command;
    let subCommanderCommand: Command;

    beforeEach(() => {
        commanderCommand = new Command('root');
        command = new PrintOrganizationCommand(commanderCommand);
        subCommanderCommand = commanderCommand.commands[0];
    });

    test('print org command is created', () => {
        expect(command).toBeDefined();
        expect(subCommanderCommand).toBeDefined();
        expect(subCommanderCommand.name()).toBe('print-org');
    });

    test('print org command has description', () => {
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