import nunjucks from 'nunjucks';

describe('Checking the nunjucksRender', () => {
    
    test("Nunjacks-testing-noob", () => {
        
        const env = nunjucks.configure(
            '.',
            {
              autoescape: false,
              trimBlocks: true,
              lstripBlocks: true,
              throwOnUndefined: false,
            });
        
        env.addFilter('object', x => {
          return JSON.stringify(x);
        });
        
        const input = "{{ appName }}"
        const templatingContext: Record<string,unknown> = {appName: "Hello.appname"}
        
        const rendered = env.renderString(input, templatingContext);
        expect(rendered).toStrictEqual(templatingContext.appName);
        
    })
    
})