import { expect } from 'chai';
import { Command } from 'commander';
import { CliProgram } from '../../cli-program';

describe('when creating the cli program', () => {

    let program: Command;

    beforeEach(() => {
        program = CliProgram.Create();
    });

    it('all commands have name', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            expect(childCommand).to.not.be.undefined;
            expect(childCommand._name).to.not.be.undefined;
        }
    });

    it('all commands take profile as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o) => o.long === '--profile');
            expect(profile).to.not.be.undefined;
            expect(profile.optional).to.be.true;
        }
    });

    it('all commands take state bucket as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o) => o.long === '--state-bucket-name');
            expect(profile).to.not.be.undefined;
            expect(profile.optional).to.be.true;
        }
    });

    it('all commands take state object as optional option', () => {
        const commands: Command[] = program.commands;
        for (const childCommand of commands) {
            const profile = childCommand.options.find((o) => o.long === '--state-object');
            expect(profile).to.not.be.undefined;
            expect(profile.optional).to.be.true;
        }
    });

});
