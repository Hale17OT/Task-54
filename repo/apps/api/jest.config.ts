import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts', '!src/**/index.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@checc/shared/(.*)$': '<rootDir>/../../libs/shared/src/$1',
    '^@checc/shared$': '<rootDir>/../../libs/shared/src',
    '^@api/(.*)$': '<rootDir>/src/$1',
  },
};

export default config;
