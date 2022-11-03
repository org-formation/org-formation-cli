const defaultConfig = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    globals: {
        'ts-jest': {
            compiler: 'ttypescript'
        }
    },
};

module.exports = {
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
            testMatch: ['<rootDir>/test/integration-tests/**/scenario-copy-to-s3-task.test.ts'],
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
