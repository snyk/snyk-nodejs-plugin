import { processPnpmWorkspaces } from '../../lib';
import * as path from 'path';

describe('process pnpm workspaces', () => {
  const originalCurrentWorkingDirectory = process.cwd();

  afterEach(() => {
    process.chdir(originalCurrentWorkingDirectory);
  });

  describe('Processing returns dep graph for workspace with multiple projects', () => {
    it.each([
      {
        packageManager: 'pnpm',
        lockFileVersion: '5',
        fixture: 'workspace-with-isolated-pkgs',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '6',
        fixture: 'workspace-with-isolated-pkgs',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '9',
        fixture: 'workspace-with-isolated-pkgs',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '5',
        fixture: 'workspace-with-cross-ref',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '6',
        fixture: 'workspace-with-cross-ref',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '9',
        fixture: 'workspace-with-cross-ref',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '5',
        fixture: 'workspace-empty-config-file',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '6',
        fixture: 'workspace-with-cross-ref',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '9',
        fixture: 'workspace-with-cross-ref',
        projects: 3,
        targetFiles: [
          'pnpm-lock.yaml',
          'packages/pkg-a/package.json',
          'packages/pkg-b/package.json',
        ],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '5',
        fixture: 'undefined-package-version',
        projects: 2,
        targetFiles: ['pnpm-lock.yaml', 'packages/pkg-a/package.json'],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '6',
        fixture: 'undefined-package-version',
        projects: 2,
        targetFiles: ['pnpm-lock.yaml', 'packages/pkg-a/package.json'],
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '9',
        fixture: 'undefined-package-version',
        projects: 2,
        targetFiles: ['pnpm-lock.yaml', 'packages/pkg-a/package.json'],
      },
    ])(
      'should build valid dep graph for $packageManager, lockfile version = $lockFileVersion',
      async ({
        packageManager,
        lockFileVersion,
        fixture,
        projects,
        targetFiles,
      }) => {
        const fixturePath = path.resolve(
          __dirname,
          '..',
          'fixtures',
          packageManager,
          `lock-v${lockFileVersion}`,
          fixture,
        );
        process.chdir(fixturePath);
        const currentDir = process.cwd();

        const resolvedTargetFiles = targetFiles.map(
          (file) => `${currentDir}/${file}`,
        );

        const result = await processPnpmWorkspaces(
          currentDir,
          {},
          resolvedTargetFiles,
        );
        expect(result.plugin.name).toEqual('snyk-nodejs-pnpm-workspaces');
        expect(result.scannedProjects.length).toEqual(projects);
        expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
      },
    );
  });

  describe('Processing returns dep graph for multiple workspaces for npm, yarn, pnpm', () => {
    it('should build valid dep graphs for the pnpm projects detected as part of a workspace', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '..',
        'fixtures',
        'workspace-multi-type',
      );
      process.chdir(fixturePath);
      const currentDir = process.cwd();

      const result = await processPnpmWorkspaces(currentDir, {}, [
        `${currentDir}/npm-workspace/package-lock.json`,
        `${currentDir}/npm-workspace/packages/a/package.json`,
        `${currentDir}/npm-workspace/packages/b/package.json`,
        `${currentDir}/yarn-workspace/yarn.lock`,
        `${currentDir}/yarn-workspace/packages/pkg-a/package.json`,
        `${currentDir}/yarn-workspace/packages/pkg-b/package.json`,
        `${currentDir}/pnpm-workspace/pnpm-lock.yaml`,
        `${currentDir}/pnpm-workspace/packages/pkg-a/package.json`,
        `${currentDir}/pnpm-workspace/packages/pkg-b/package.json`,
        `${currentDir}/pnpm-workspace-2/pnpm-lock.yaml`,
        `${currentDir}/pnpm-workspace-2/packages/pkg-a/package.json`,
        `${currentDir}/pnpm-workspace-2/packages/pkg-b/package.json`,
      ]);
      expect(result.plugin.name).toEqual('snyk-nodejs-pnpm-workspaces');
      expect(result.scannedProjects.length).toEqual(6);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });
  });
});
