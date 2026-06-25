import { InvalidUserInputError } from 'snyk-nodejs-lockfile-parser';
import { inspect } from '../lib/index';
import * as path from 'path';

describe('inspect', () => {
  const originalCurrentWorkingDirectory = process.cwd();

  afterEach(() => {
    process.chdir(originalCurrentWorkingDirectory);
  });

  describe('lockfile-based projects', () => {
    it.each([
      {
        packageManager: 'pnpm',
        lockFileVersion: '5',
        fixture: 'simple-app',
        targetFile: 'pnpm-lock.yaml',
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '6',
        fixture: 'simple-app',
        targetFile: 'pnpm-lock.yaml',
      },
      {
        packageManager: 'pnpm',
        lockFileVersion: '9',
        fixture: 'simple-app',
        targetFile: 'pnpm-lock.yaml',
      },
      {
        packageManager: 'npm',
        lockFileVersion: '2',
        fixture: 'simple-app',
        targetFile: 'package-lock.json',
      },
      {
        packageManager: 'yarn',
        lockFileVersion: '1',
        fixture: 'simple-app',
        targetFile: 'yarn.lock',
      },
      {
        packageManager: 'yarn',
        lockFileVersion: '2',
        fixture: 'simple-app',
        targetFile: 'yarn.lock',
      },
    ])(
      'should build valid dep graph for $packageManager, lockfile version = $lockFileVersion, fixture = $fixture',
      async ({ packageManager, lockFileVersion, fixture, targetFile }) => {
        const fixturePath = path.resolve(
          __dirname,
          'fixtures',
          packageManager,
          `lock-v${lockFileVersion}`,
          fixture,
        );
        process.chdir(fixturePath);

        const result = await inspect('.', targetFile, {});
        expect(result.plugin.name).toEqual('snyk-nodejs-lockfile-parser');
        expect(result.scannedProjects.length).toEqual(1);
        expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
      },
    );

    it('GIVEN includeComponentMetadata for an npm project THEN dep-graph nodes carry hash and distribution:url labels', async () => {
      const fixturePath = path.resolve(
        __dirname,
        'fixtures',
        'npm',
        'lock-v2',
        'simple-app',
      );
      process.chdir(fixturePath);

      const withMetadata = await inspect('.', 'package-lock.json', {
        includeComponentMetadata: true,
      });
      const metaNodes = withMetadata.scannedProjects[0].depGraph
        ?.toJSON()
        .graph.nodes.filter((node) => node.nodeId !== 'root-node');
      expect(metaNodes && metaNodes.length).toBeGreaterThan(0);
      metaNodes?.forEach((node) => {
        expect(node.info?.labels?.['hash:sha-512']).toMatch(/^[0-9a-f]{128}$/);
        expect(node.info?.labels?.['distribution:url']).toMatch(/^https:\/\//);
      });

      // Without the flag the labels must be absent.
      const withoutMetadata = await inspect('.', 'package-lock.json', {});
      withoutMetadata.scannedProjects[0].depGraph
        ?.toJSON()
        .graph.nodes.forEach((node) => {
          expect(node.info?.labels?.['hash:sha-512']).toBeUndefined();
          expect(node.info?.labels?.['distribution:url']).toBeUndefined();
        });
    });

    it('GIVEN includeComponentMetadata for an npm lockfile v1 project THEN depTree nodes carry hash and distribution:url labels', async () => {
      const fixturePath = path.resolve(
        __dirname,
        'fixtures',
        'npm',
        'lock-v1',
        'mixed-hashes',
      );
      process.chdir(fixturePath);

      const result = await inspect('.', 'package-lock.json', {
        includeComponentMetadata: true,
      });
      // npm v1 is parsed via the legacy depTree path, not a DepGraph.
      const depTree = result.scannedProjects[0].depTree as any;
      expect(depTree).toBeDefined();

      const accepts = depTree.dependencies['accepts'];
      expect(accepts.labels['hash:sha-512']).toMatch(/^[0-9a-f]{128}$/);
      expect(accepts.labels['distribution:url']).toBe(
        'https://registry.npmjs.org/accepts/-/accepts-1.3.7.tgz',
      );

      // sha1 integrity (typical of v1 lockfiles) -> hash:sha-1.
      const ansiRegex = depTree.dependencies['ansi-regex'];
      expect(ansiRegex.labels['hash:sha-1']).toMatch(/^[0-9a-f]{40}$/);
      expect(ansiRegex.labels['distribution:url']).toBe(
        'https://registry.npmjs.org/ansi-regex/-/ansi-regex-2.1.1.tgz',
      );

      // Without the flag the labels must be absent.
      const withoutMetadata = await inspect('.', 'package-lock.json', {});
      const acceptsNoMeta = (withoutMetadata.scannedProjects[0].depTree as any)
        .dependencies['accepts'];
      expect(acceptsNoMeta.labels?.['hash:sha-512']).toBeUndefined();
      expect(acceptsNoMeta.labels?.['distribution:url']).toBeUndefined();
    });

    it('should throw error trying to scan a pnpm workspace as a simple file', async () => {
      const packageManager = 'pnpm',
        lockFileVersion = '9',
        fixture = 'workspace-with-cross-ref',
        targetFile = 'pnpm-lock.yaml';
      const fixturePath = path.resolve(
        __dirname,
        'fixtures',
        packageManager,
        `lock-v${lockFileVersion}`,
        fixture,
      );
      process.chdir(fixturePath);

      await expect(() => inspect('.', targetFile, {})).rejects.toThrow(
        new InvalidUserInputError(
          'Both `pnpm-lock.yaml` and `pnpm-workspace.yaml` were found in ' +
            fixturePath +
            '.\n' +
            'Please run your command again specifying `--all-projects` flag.',
        ),
      );
    });
  });
});
