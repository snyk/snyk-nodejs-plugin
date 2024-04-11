import * as modulesParser from './npm-modules-parser';
import * as lockParser from './npm-lock-parser';
import * as types from './types';
import { MissingTargetFileError } from './errors';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';
import { DepGraph } from '@snyk/dep-graph';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';

function isResDepGraph(depRes: PkgTree | DepGraph): depRes is DepGraph {
  return 'rootPkg' in depRes;
}

export async function inspect(
  root: string,
  targetFile: string,
  options: types.Options = {},
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }
  const isLockFileBased =
    targetFile.endsWith('package-lock.json') ||
    targetFile.endsWith('yarn.lock');

  const getLockFileDeps = isLockFileBased && !options.traverseNodeModules;
  const depRes: PkgTree | DepGraph = getLockFileDeps
    ? await lockParser.parse(root, targetFile, options)
    : await modulesParser.parse(root, targetFile, options);

  let scannedProjects: any[] = [];
  if (isResDepGraph(depRes)) {
    scannedProjects = [{ depGraph: depRes }];
  } else {
    scannedProjects = [{ depTree: depRes }];
  }

  return {
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: process.version,
    },
    scannedProjects,
  };
}
