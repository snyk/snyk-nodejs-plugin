import {
  packageJsonBelongsToWorkspace,
  processYarnWorkspaces,
} from '../../lib/workspaces/yarn-workspaces-parser';
import { buildDepGraph } from '../../lib/lock-parser/build-dep-graph';
import { NodeLockfileVersion } from 'snyk-nodejs-lockfile-parser';
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

// A Yarn Berry workspace package consumed as a production dependency must not promote its
// dev-only tooling into the production graph. The fixture has apps/my-app -> (prod)
// libraries/shared-lib, where shared-lib has ONLY devDependencies (webpack, babel, ...).
// Those must not appear in my-app's graph.
describe('yarn workspace dev-dependency leak', () => {
  const fixtureRoot = path.resolve(
    __dirname,
    '..',
    'fixtures',
    'yarn-workspace-dev-deps',
  );

  // shared-lib's dev-only build tooling that previously leaked into my-app's prod graph.
  const DEV_ONLY_TOOLING = [
    'webpack',
    'webpack-cli',
    '@babel/core',
    '@babel/preset-env',
    'babel-loader',
  ];

  const pkgNamesOf = (depGraph): string[] =>
    depGraph.getDepPkgs().map((p: { name: string }) => p.name);

  describe('--yarn-workspaces path (processYarnWorkspaces)', () => {
    it('does not promote consumed workspace devDependencies to prod', async () => {
      const result = await processYarnWorkspaces(fixtureRoot, { dev: false }, [
        `${fixtureRoot}/yarn.lock`,
        `${fixtureRoot}/package.json`,
        `${fixtureRoot}/apps/my-app/package.json`,
        `${fixtureRoot}/libraries/shared-lib/package.json`,
        `${fixtureRoot}/libraries/private-lib/package.json`,
      ]);

      const myApp = result.scannedProjects.find((p) =>
        p.targetFile?.includes('apps/my-app'),
      );
      if (!myApp) {
        throw new Error('my-app project was not scanned');
      }

      const names = pkgNamesOf(myApp.depGraph);

      // shared-lib is a genuine prod dependency of my-app and must remain.
      expect(names).toContain('@demo/shared-lib');

      // None of shared-lib's dev-only tooling should be present.
      for (const devPkg of DEV_ONLY_TOOLING) {
        expect(names).not.toContain(devPkg);
      }
    });

    it('still includes consumed workspace devDependencies when --dev is set', async () => {
      const result = await processYarnWorkspaces(fixtureRoot, { dev: true }, [
        `${fixtureRoot}/yarn.lock`,
        `${fixtureRoot}/package.json`,
        `${fixtureRoot}/apps/my-app/package.json`,
        `${fixtureRoot}/libraries/shared-lib/package.json`,
        `${fixtureRoot}/libraries/private-lib/package.json`,
      ]);

      const myApp = result.scannedProjects.find((p) =>
        p.targetFile?.includes('apps/my-app'),
      );
      if (!myApp) {
        throw new Error('my-app project was not scanned');
      }
      const names = pkgNamesOf(myApp.depGraph);
      expect(names).toEqual(expect.arrayContaining(DEV_ONLY_TOOLING));
    });
  });

  describe('--all-projects path (buildDepGraph)', () => {
    it('prunes workspace dev deps discovered from the root manifest', async () => {
      // Build my-app's graph the way the per-manifest --all-projects path does, against the
      // root yarn.lock. The fix discovers sibling member manifests from the workspace root.
      const depGraph = await buildDepGraph(
        fixtureRoot,
        'apps/my-app/package.json',
        'yarn.lock',
        NodeLockfileVersion.YarnLockV2,
        {
          includeDevDeps: false,
          includeOptionalDeps: true,
          strictOutOfSync: false,
          pruneCycles: true,
        } as any,
      );

      const names = pkgNamesOf(depGraph);
      expect(names).toContain('@demo/shared-lib');
      for (const devPkg of DEV_ONLY_TOOLING) {
        expect(names).not.toContain(devPkg);
      }
    });
  });

  // A single scan can span two independent yarn workspaces that contain a member with the SAME
  // package name (`@acme/shared`). In workspace-a `@acme/shared` has `ms` as a PROD dep; in
  // workspace-b `ms` is a DEV dep. The workspacePackages map must be scoped per workspace root,
  // otherwise workspace-b's manifest would prune workspace-a's `@acme/shared` node and drop
  // `ms` (a genuine production dependency).
  describe('cross-workspace name collision', () => {
    const collisionRoot = path.resolve(
      __dirname,
      '..',
      'fixtures',
      'yarn-workspace-name-collision',
    );

    it('scopes the prune to each workspace root, keeping a real prod dep', async () => {
      const result = await processYarnWorkspaces(
        collisionRoot,
        { dev: false },
        [
          `${collisionRoot}/workspace-a/yarn.lock`,
          `${collisionRoot}/workspace-a/package.json`,
          `${collisionRoot}/workspace-a/packages/app-a/package.json`,
          `${collisionRoot}/workspace-a/packages/shared/package.json`,
          `${collisionRoot}/workspace-b/packages/shared/package.json`,
        ],
      );

      const appA = result.scannedProjects.find((p) =>
        p.targetFile?.includes('packages/app-a'),
      );
      if (!appA) {
        throw new Error('app-a project was not scanned');
      }

      const names = pkgNamesOf(appA.depGraph);
      expect(names).toContain('@acme/shared');
      // `ms` is a real prod dep of workspace-a's @acme/shared; a global map would let
      // workspace-b's manifest (ms = dev) prune it. Scoping must keep it.
      expect(names).toContain('ms');
    });
  });
});
