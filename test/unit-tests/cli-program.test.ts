import { Command, Option } from 'commander';
import { CliProgram } from '../../cli-program';

describe('when creating the cli program', () => {

    let program: Command;

    beforeEach(() => {
        program = CliProgram.Create();
    });

    test('all commands have name', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            expect(childCommand).toBeDefined();
            expect(childCommand._name).toBeDefined();
        }
    });

    test('all commands take profile as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o: Option) => o.long === '--profile');
            expect(profile).toBeDefined();
            expect(profile.optional).toBe(true);
        }
    });

    test('all commands take state bucket as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o: Option) => o.long === '--state-bucket-name');
            expect(profile).toBeDefined();
            expect(profile.optional).toBe(true);
        }
    });

    test('all commands take state object as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o: Option) => o.long === '--state-object');
            expect(profile).toBeDefined();
            expect(profile.optional).toBe(true);
        }
    });

});
