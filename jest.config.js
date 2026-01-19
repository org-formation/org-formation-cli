const defaultConfig = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        '^~aws-provider/(.*)$': '<rootDir>/src/aws-provider/$1',
        '^~build-tasks/(.*)$': '<rootDir>/src/build-tasks/$1',
        '^~cfn-binder/(.*)$': '<rootDir>/src/cfn-binder/$1',
        '^~change-set/(.*)$': '<rootDir>/src/change-set/$1',
        '^~commands/(.*)$': '<rootDir>/src/commands/$1',
        '^~core/(.*)$': '<rootDir>/src/core/$1',
        '^~org-binder/(.*)$': '<rootDir>/src/org-binder/$1',
        '^~parser/(.*)$': '<rootDir>/src/parser/$1',
        '^~state/(.*)$': '<rootDir>/src/state/$1',
        '^~writer/(.*)$': '<rootDir>/src/writer/$1',
        '^~sls-com/(.*)$': '<rootDir>/src/sls-com/$1',
        '^~plugin/(.*)$': '<rootDir>/src/plugin/$1',
        '^~util/(.*)$': '<rootDir>/src/util/$1',
        '^~yaml-cfn/(.*)$': '<rootDir>/src/yaml-cfn/$1',
        '^~org-formation-error$': '<rootDir>/src/org-formation-error',
    },
};

module.exports = {
    testTimeout: 10000,
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/test/'
    ],
    coverageReporters: [
        'json',
        'lcov',
        'text',
        'cobertura'
    ],
    projects: [
        // TODO: add linter to jest
        // {
        //     displayName: {
        //         name: 'lint',
        //         color: 'yellow',
        //     },
        //     runner: 'jest-runner-eslint',
        //     testMatch: ['<rootDir>/**/*.ts'],
        // },
        {
            ...defaultConfig,
            displayName: {
                name: 'unit-test',
                color: 'blue',
            },
            testMatch: ['<rootDir>/test/unit-tests/**/*.test.ts'],
        },
        {
            ...defaultConfig,
            displayName: {
                name: 'integration-test',
                color: 'magenta',
            },
            testMatch: ['<rootDir>/test/integration-tests/**/*.test.ts'],
        },
        {
            ...defaultConfig,
            displayName: {
                name: 'validation',
                color: 'magenta',
            },
            testMatch: ['<rootDir>/test/validation/**/*.test.ts'],
        }
    ]
};
