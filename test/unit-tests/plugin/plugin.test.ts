import { PluginProvider, IBuildTaskPlugin } from "~plugin/plugin";

describe('when iterating over registered plugins', () => {
    let plugins: IBuildTaskPlugin<any, any, any>[];

    beforeEach(() => {
        plugins = PluginProvider.GetPlugins();
    });
    test('copy to s3 plugin is found', () => {
        let s3plugin = plugins.find(x=>x.typeForTask === 'copy-to-s3');
        expect(s3plugin).toBeDefined();
    });

    test('cdk plugin is found', () => {
        let cdkplugin = plugins.find(x=>x.typeForTask === 'update-cdk');
        expect(cdkplugin).toBeDefined();
    });

    test('sls plugin is found', () => {
        let slsplugin = plugins.find(x=>x.typeForTask === 'update-serverless.com');
        expect(slsplugin).toBeDefined();
    });
});


describe('when getting plugin by type', () => {

    test('copy to s3 plugin is found', () => {
        let s3Plugin = PluginProvider.GetPlugin('copy-to-s3');
        expect(s3Plugin).toBeDefined();
    });

    test('cdk plugin is found', () => {
        let cdkPlugin = PluginProvider.GetPlugin('cdk');
        expect(cdkPlugin).toBeDefined();
    });

    test('sls plugin is found', () => {
        let slsPlugin = PluginProvider.GetPlugin('serverless.com');
        expect(slsPlugin).toBeDefined();
    });

    test('unknown plugin throws error', () => {
        expect(() =>PluginProvider.GetPlugin('xyzz?') ).toThrowError('xyzz?');
    });
});
