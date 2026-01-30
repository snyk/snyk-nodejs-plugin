import {
  packageJsonBelongsToWorkspace,
  processYarnWorkspaces,
} from '../../lib/workspaces/yarn-workspaces-parser';
import * as path from 'path';

const yarnWorkspacesMap = {
  'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json': {
    workspaces: ['packages/*'],
  },
  'snyk/test/acceptance/workspaces/yarn-workspace/package.json': {
    workspaces: ['libs/*/**', 'tools/*'],
  },
};

const yarnWorkspacesMapWindows = {
  'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json':
    {
      workspaces: ['packages'],
    },
  'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json': {
    workspaces: ['libs/*/**', 'tools/*'],
  },
  'C:\\snyk\\yarn-workspace\\package.json': {
    workspaces: ['libs\\*\\**', 'tools\\*'],
  },
};

describe('packageJsonBelongsToWorkspace', () => {
  test('does not match workspace root', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
  test('correctly matches a workspace with /* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/packages/apple/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with /*/** globs', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace/libs/a/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('does not match a workspace outside declared globs', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace/packages/a/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
});

describe('packageJsonBelongsToWorkspace Windows', () => {
  test('does not match workspace root', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
  test('correctly matches a workspace with /* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\packages\\apple\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with \\* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'C:\\snyk\\yarn-workspace\\tools\\apple\\package.json';
    const workspaceRoot = 'C:\\snyk\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with /*/** globs', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\libs\\a\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('does not match a workspace outside declared globs', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\packages\\a\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });

  describe('Processing returns dep graph for multiple workspaces for npm, yarn, pnpm', () => {
    it('should build valid dep graphs for the yarn projects detected as part of a workspace', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '..',
        'fixtures',
        'workspace-multi-type',
      );
      process.chdir(fixturePath);
      const currentDir = process.cwd();

      const result = await processYarnWorkspaces(currentDir, {}, [
        `${currentDir}/npm-workspace/package-lock.json`,
        `${currentDir}/npm-workspace/packages/a/package.json`,
        `${currentDir}/npm-workspace/packages/b/package.json`,
        `${currentDir}/yarn-workspace/yarn.lock`,
        `${currentDir}/yarn-workspace/packages/pkg-a/package.json`,
        `${currentDir}/yarn-workspace/packages/pkg-b/package.json`,
        `${currentDir}/pnpm-workspace/pnpm-lock.yaml`,
        `${currentDir}/pnpm-workspace/packages/pkg-a/package.json`,
        `${currentDir}/pnpm-workspace/packages/pkg-b/package.json`,
      ]);
      expect(result.plugin.name).toEqual('snyk-nodejs-yarn-workspaces');
      expect(result.scannedProjects.length).toEqual(3);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });
  });

  describe('showNpmScope feature flag forwarding', () => {
    it('should forward showNpmScope flag when set to true', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '..',
        'fixtures',
        'workspace-multi-type',
      );
      process.chdir(fixturePath);
      const currentDir = process.cwd();

      const result = await processYarnWorkspaces(
        currentDir,
        { showNpmScope: true },
        [
          `${currentDir}/yarn-workspace/yarn.lock`,
          `${currentDir}/yarn-workspace/package.json`,
          `${currentDir}/yarn-workspace/packages/pkg-a/package.json`,
          `${currentDir}/yarn-workspace/packages/pkg-b/package.json`,
        ],
      );

      expect(result.plugin.name).toEqual('snyk-nodejs-yarn-workspaces');
      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });

    it('should forward showNpmScope flag when set to false', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '..',
        'fixtures',
        'workspace-multi-type',
      );
      process.chdir(fixturePath);
      const currentDir = process.cwd();

      const result = await processYarnWorkspaces(
        currentDir,
        { showNpmScope: false },
        [
          `${currentDir}/yarn-workspace/yarn.lock`,
          `${currentDir}/yarn-workspace/package.json`,
          `${currentDir}/yarn-workspace/packages/pkg-a/package.json`,
          `${currentDir}/yarn-workspace/packages/pkg-b/package.json`,
        ],
      );

      expect(result.plugin.name).toEqual('snyk-nodejs-yarn-workspaces');
      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });

    it('should work correctly when showNpmScope is undefined (backward compatibility)', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '..',
        'fixtures',
        'workspace-multi-type',
      );
      process.chdir(fixturePath);
      const currentDir = process.cwd();

      const result = await processYarnWorkspaces(currentDir, {}, [
        `${currentDir}/yarn-workspace/yarn.lock`,
        `${currentDir}/yarn-workspace/package.json`,
        `${currentDir}/yarn-workspace/packages/pkg-a/package.json`,
        `${currentDir}/yarn-workspace/packages/pkg-b/package.json`,
      ]);

      expect(result.plugin.name).toEqual('snyk-nodejs-yarn-workspaces');
      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });
  });
});
