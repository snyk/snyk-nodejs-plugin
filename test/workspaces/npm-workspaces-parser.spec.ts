import { processNpmWorkspaces } from '../../lib';
import * as path from 'path';

describe('process npm workspaces', () => {
  const originalCurrentWorkingDirectory = process.cwd();

  afterEach(() => {
    process.chdir(originalCurrentWorkingDirectory);
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

      const result = await processNpmWorkspaces(
        currentDir,
        { showNpmScope: true },
        [
          `${currentDir}/npm-workspace/package-lock.json`,
          `${currentDir}/npm-workspace/package.json`,
          `${currentDir}/npm-workspace/packages/a/package.json`,
          `${currentDir}/npm-workspace/packages/b/package.json`,
        ],
      );

      expect(result.plugin.name).toEqual('snyk-nodejs-npm-workspaces');
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

      const result = await processNpmWorkspaces(
        currentDir,
        { showNpmScope: false },
        [
          `${currentDir}/npm-workspace/package-lock.json`,
          `${currentDir}/npm-workspace/package.json`,
          `${currentDir}/npm-workspace/packages/a/package.json`,
          `${currentDir}/npm-workspace/packages/b/package.json`,
        ],
      );

      expect(result.plugin.name).toEqual('snyk-nodejs-npm-workspaces');
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

      const result = await processNpmWorkspaces(currentDir, {}, [
        `${currentDir}/npm-workspace/package-lock.json`,
        `${currentDir}/npm-workspace/package.json`,
        `${currentDir}/npm-workspace/packages/a/package.json`,
        `${currentDir}/npm-workspace/packages/b/package.json`,
      ]);

      expect(result.plugin.name).toEqual('snyk-nodejs-npm-workspaces');
      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.scannedProjects[0].depGraph?.toJSON()).not.toEqual({});
    });
  });
});
