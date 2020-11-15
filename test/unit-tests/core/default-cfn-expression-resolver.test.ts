import { CfnExpressionResolver } from "~core/cfn-expression-resolver";
import { TestTemplates } from "../test-templates";
import { ICfnRefExpression, ICfnCopyValue } from "~core/cfn-expression";
import { AwsUtil } from "~util/aws-util";

describe('when having a default expression resolver', () => {
    let resolver: CfnExpressionResolver;
    let target: any;

    beforeEach(async () => {
        const template = TestTemplates.createBasicTemplate();
        const state = TestTemplates.createState(template);
        resolver = await CfnExpressionResolver.CreateDefaultResolver('Account2', '1232342341236', 'eu-central-1', 'XXX',  template.organizationSection, state, true);

        target = {
            obj: { att: 'val'},
            arr: ['val1', 'val2'],
            emptyArr: [],
            att: 'val',
        }
    });

    afterEach(() => {
        jest.restoreAllMocks();
    })

    test('then can resolve object without resolvables', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });

    test('CurrentAccount resolves to physical account ID', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = '1232342341236';
        target.test = {Ref: 'CurrentAccount'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });

    test('AWSAccount resolves to physical account ID', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = '1232342341236';
        target.test = {Ref: 'AWSAccount'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });

    test('Ref to specific account resolves to physical account ID', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = '1232342341234';
        target.test = {Ref: 'MasterAccount'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });

    test('Ref to ORG::PrincipalOrgID resolves to OrgID', async ()=>{
        const getOrgIdMock = jest.spyOn(AwsUtil, 'GetPrincipalOrgId' ).mockResolvedValue('o-abcdefgh');

        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = 'o-abcdefgh';
        target.test = {Ref: 'ORG::PrincipalOrgID'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
        expect(getOrgIdMock).toHaveBeenCalledTimes(1);
    });

    test('Ref to AWS::AccountId resolves to physical account ID', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = '1232342341236';
        target.test = {Ref: 'AWS::AccountId'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });

    test('Ref to AWS::Region resolves to region', async ()=>{
        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = 'eu-central-1';
        target.test = {Ref: 'AWS::Region'} as ICfnRefExpression;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
    });


    test('!CopyValue retrieves exported value', async ()=>{
        const getExportMock = jest.spyOn(AwsUtil, 'GetCloudFormationExport').mockResolvedValue('abcdefg');

        const toMatchWith = JSON.parse(JSON.stringify(target));
        toMatchWith.test = 'abcdefg';
        target.test = {'Fn::CopyValue': ['ExportName']} as ICfnCopyValue;
        const resolved = await resolver.resolve(target);
        expect(resolved).toMatchObject(toMatchWith);
        expect(getExportMock).toHaveBeenCalledTimes(1);
        expect(getExportMock).toHaveBeenCalledWith('ExportName','1232342341236', 'eu-central-1', 'XXX');
    });
});