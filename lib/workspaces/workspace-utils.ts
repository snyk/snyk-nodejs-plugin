import * as debugModule from 'debug';
import * as pathUtil from 'path';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import * as micromatch from 'micromatch';
import { sortBy, groupBy } from 'lodash';
import { PnpmWorkspacesMap } from '../types';
import { fileExists, getFileContents, normalizeFilePath } from '../utils';

const debug = debugModule('snyk-workspaces');

export function sortTargetFiles(targetFiles: string[], rootFiles: string[]) {
  // the order of targetFiles folders is important
  // must have the root level most folders at the top
  const mappedAndFiltered = targetFiles
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => rootFiles.includes(res.base));
  const sorted = sortBy(mappedAndFiltered, 'dir');

  const groupedTargetFiles: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = groupBy(sorted, 'dir');

  return groupedTargetFiles;
}

export function getWorkspacesMap(
  root: string,
  directory: string,
  packageJson: {
    fileName: string;
    content: string;
  },
): PnpmWorkspacesMap {
  const pnpmWorkspacesMap = {};
  const pnpmWorkspacesPath = pathUtil.join(directory, 'pnpm-workspace.yaml');
  if (!fileExists(root, pnpmWorkspacesPath)) {
    return pnpmWorkspacesMap;
  }
  const file = getFileContents(root, pnpmWorkspacesPath);
  if (!file) {
    return pnpmWorkspacesMap;
  }

  try {
    const rootFileWorkspacesDefinitions = lockFileParser.getPnpmWorkspaces(
      file.content,
    );

    if (rootFileWorkspacesDefinitions && rootFileWorkspacesDefinitions.length) {
      pnpmWorkspacesMap[packageJson.fileName] = {
        workspaces: rootFileWorkspacesDefinitions,
      };
    }
  } catch (e: any) {
    debug('Failed to process a workspace', e.message);
  }
  return pnpmWorkspacesMap;
}

export function packageJsonBelongsToWorkspace(
  packageJsonFileName: string,
  pnpmWorkspacesMap: PnpmWorkspacesMap,
  workspaceRoot: string,
): boolean {
  const workspaceRootFolder = pathUtil.dirname(
    normalizeFilePath(workspaceRoot),
  );
  const workspacesGlobs = (
    pnpmWorkspacesMap[workspaceRoot].workspaces || []
  ).map((workspace) => pathUtil.join(workspaceRootFolder, workspace));

  const match = micromatch.isMatch(
    normalizeFilePath(packageJsonFileName),
    workspacesGlobs.map((p) => normalizeFilePath(pathUtil.join(p, '**'))),
  );
  return match;
}
