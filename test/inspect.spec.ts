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
  });
});
