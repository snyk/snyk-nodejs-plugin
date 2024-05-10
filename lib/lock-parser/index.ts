import * as path from 'path';
import * as fs from 'fs';
import { buildDepGraph } from './build-dep-graph';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { NodeLockfileVersion, PkgTree } from 'snyk-nodejs-lockfile-parser';
import { Options } from '../types';
import { DepGraph } from '@snyk/dep-graph';

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<PkgTree | DepGraph> {
  const lockFileFullPath = path.resolve(root, targetFile);
  if (!fs.existsSync(lockFileFullPath)) {
    throw new Error(
      'Lockfile ' + targetFile + ' not found at location: ' + lockFileFullPath,
    );
  }

  const fullPath = path.parse(lockFileFullPath);
  const manifestFileFullPath = path.resolve(fullPath.dir, 'package.json');
  const shrinkwrapFullPath = path.resolve(fullPath.dir, 'npm-shrinkwrap.json');

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new Error(
      `Could not find package.json at ${manifestFileFullPath} ` +
        `(lockfile found at ${targetFile})`,
    );
  }

  if (fs.existsSync(shrinkwrapFullPath)) {
    throw new Error(
      'Both `npm-shrinkwrap.json` and `package-lock.json` were found in ' +
        fullPath.dir +
        '.\n' +
        'Please run your command again specifying `--file=package.json` flag.',
    );
  }

  const strictOutOfSync = options.strictOutOfSync !== false;
  const lockfileVersion =
    lockFileParser.getLockfileVersionFromFile(lockFileFullPath);
  if (
    lockfileVersion === NodeLockfileVersion.YarnLockV1 ||
    lockfileVersion === NodeLockfileVersion.YarnLockV2 ||
    lockfileVersion === NodeLockfileVersion.NpmLockV2 ||
    lockfileVersion === NodeLockfileVersion.NpmLockV3 ||
    lockfileVersion === NodeLockfileVersion.PnpmLockV5 ||
    lockfileVersion === NodeLockfileVersion.PnpmLockV6 ||
    lockfileVersion === NodeLockfileVersion.PnpmLockV9
  ) {
    return await buildDepGraph(
      root,
      manifestFileFullPath,
      lockFileFullPath,
      lockfileVersion,
      {
        includeDevDeps: options.dev || false,
        includeOptionalDeps: true,
        strictOutOfSync,
        pruneCycles: true,
      },
    );
  }

  return lockFileParser.buildDepTreeFromFiles(
    root,
    manifestFileFullPath,
    lockFileFullPath,
    options.dev,
    strictOutOfSync,
  );
}
