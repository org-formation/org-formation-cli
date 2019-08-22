import { expect } from 'chai';
import * as chai from 'chai';
import { TemplateRoot } from '../../../src/parser/parser';

chai.use(require('chai-as-promised'));

describe('when parsing file', () => {

    it('it throws for empty file', () => {
        expect(() => { TemplateRoot.create('./test/resources/empty-file.yml'); }).to.throw(/empty-file/);
        expect(() => { TemplateRoot.create('./test/resources/empty-file.yml'); }).to.throw(/is empty/);
    });

    it('it throws for invalid version', () => {
        expect(() => { TemplateRoot.create('./test/resources/invalid-version.yml'); }).to.throw(/Unexpected AWSTemplateFormatVersion version/);
    });

    it('it throws for invalid yaml', () => {
        expect(() => { TemplateRoot.create('./test/resources/invalid-yml.yml'); }).to.throw(/AWSTemplateFormatVersion is missing/);
    });

    it('it throws for missing version', () => {
        expect(() => { TemplateRoot.create('./test/resources/missing-version.yml'); }).to.throw(/AWSTemplateFormatVersion is missing/);
    });

    it('it throws for missing organization attribute', () => {
        expect(() => { TemplateRoot.create('./test/resources/missing-organization.yml'); }).to.throw(/Organization attribute is missing/);
    });

    it('it throws for invalid include (not found)', () => {
        expect(() => { TemplateRoot.create('./test/resources/invalid-include-notfound.yml'); }).to.throw(/no such file or directory/);
        expect(() => { TemplateRoot.create('./test/resources/invalid-include-notfound.yml'); }).to.throw(/\/not-found.yml/);
    });

    it('it throws for invalid include (invalid yml)', () => {
        expect(() => { TemplateRoot.create('./test/resources/invalid-include-invalid-yml.yml'); }).to.throw();
    });
});

describe('when loading basic organization from file', () => {
    let basic: TemplateRoot;

    beforeEach(() => {
        basic = TemplateRoot.create('./test/resources/valid-basic.yml');
    });

    it('it parses successfully', () => {
        expect(basic).to.not.be.undefined;
    });

    it('it contains master account', () => {
        expect(basic.organizationSection.masterAccount).to.not.be.undefined;
    });

    it('master account has logical id and type', () => {
        expect(basic.organizationSection.masterAccount.logicalId).to.eq('MasterAccount');
        expect(basic.organizationSection.masterAccount.type).to.eq('OC::ORG::MasterAccount');
    });

    it('master account has the right attributes', () => {
        expect(basic.organizationSection.masterAccount.accountName).to.eq('My Organization Root');
        expect(basic.organizationSection.masterAccount.accountId).to.eq('123456789012');
        expect(basic.organizationSection.masterAccount.rootEmail).to.be.undefined;
    });

    it('it contains no other organizational resources', () => {
        expect(basic.organizationSection.accounts.length).to.eq(0);
        expect(basic.organizationSection.organizationalUnits.length).to.eq(0);
        expect(basic.organizationSection.serviceControlPolicies.length).to.eq(0);
        expect(basic.organizationSection.organizationRoot).to.be.undefined;
    });
});

describe('when loading basic organization using include', () => {
    let basic: TemplateRoot;
    let include: TemplateRoot;

    beforeEach(() => {
        basic = TemplateRoot.create('./test/resources/valid-basic.yml');
        include = TemplateRoot.create('./test/resources/valid-include.yml');
    });

    it('it contains same organization contents when loading directly', () => {
        expect(JSON.stringify(include.contents.Organization)).to.eq(JSON.stringify(basic.contents.Organization));
    });
});

describe('when loading basic organization and regular cloudformation', () => {
    let template: TemplateRoot;

    beforeEach(() => {
        template = TemplateRoot.create('./test/resources/valid-regular-cloudformation.yml');
    });

    it('template contains organization resource', () => {
        expect(template.organizationSection.resources.length).to.eq(1);
    });

    it('template contains cloudformation resource', () => {
        expect(template.resourcesSection.resources.length).to.eq(1);
    });
    it('template contains output', () => {
        expect(template.contents.Outputs).to.not.be.undefined;
    });
});
