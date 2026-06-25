import * as baseDebug from 'debug';
import * as pathUtil from 'path';
import { sortBy, groupBy } from 'lodash';
import * as micromatch from 'micromatch';

const debug = baseDebug('snyk-yarn-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { MultiProjectResultCustom, ScannedProjectCustom } from '../types';
import { getFileContents } from '../utils';
import { NoSupportedManifestsFoundError } from '../errors';
import { DepGraph } from '@snyk/dep-graph';
import {
  collectWorkspaceManifestsByDir,
  workspacePackagesUnderRoot,
} from './workspace-utils';

interface YarnWorkspacesMap {
  [packageJsonName: string]: {
    workspaces: string[];
  };
}

export function getWorkspacesMap(file: {
  content: string;
  fileName: string;
}): YarnWorkspacesMap {
  const yarnWorkspacesMap = {};
  if (!file) {
    return yarnWorkspacesMap;
  }

  try {
    const rootFileWorkspacesDefinitions = lockFileParser.getYarnWorkspaces(
      file.content,
    );

    if (rootFileWorkspacesDefinitions && rootFileWorkspacesDefinitions.length) {
      yarnWorkspacesMap[file.fileName] = {
        workspaces: rootFileWorkspacesDefinitions,
      };
    }
  } catch (e: any) {
    debug('Failed to process a workspace', e.message);
  }
  return yarnWorkspacesMap;
}

export function packageJsonBelongsToWorkspace(
  packageJsonFileName: string,
  yarnWorkspacesMap: YarnWorkspacesMap,
  workspaceRoot: string,
): boolean {
  const workspaceRootFolder = pathUtil.dirname(
    workspaceRoot.replace(/\\/g, '/'),
  );
  const workspacesGlobs = (
    yarnWorkspacesMap[workspaceRoot].workspaces || []
  ).map((workspace) => pathUtil.join(workspaceRootFolder, workspace));

  const match = micromatch.isMatch(
    packageJsonFileName.replace(/\\/g, '/'),
    workspacesGlobs.map((p) =>
      pathUtil.normalize(pathUtil.join(p, '**')).replace(/\\/g, '/'),
    ),
  );
  return match;
}

export async function processYarnWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
    yarnWorkspaces?: boolean;
    showNpmScope?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  // the order of yarnTargetFiles folders is important
  // must have the root level most folders at the top
  const mappedAndFiltered = targetFiles
    .map((p) => ({ path: p, ...pathUtil.parse(p) }))
    .filter((res) => ['package.json', 'yarn.lock'].includes(res.base));
  const sorted = sortBy(mappedAndFiltered, 'dir');

  const yarnTargetFiles: {
    [dir: string]: Array<{
      path: string;
      base: string;
      dir: string;
    }>;
  } = groupBy(sorted, 'dir');

  debug(`Processing potential Yarn workspaces (${targetFiles.length})`);
  if (settings.yarnWorkspaces && Object.keys(yarnTargetFiles).length === 0) {
    throw NoSupportedManifestsFoundError([root]);
  }
  let yarnWorkspacesMap = {};
  const yarnWorkspacesFilesMap = {};
  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-yarn-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };

  // Read every workspace member's package.json once, indexed by directory. The main loop
  // reuses these contents, and each parse derives a map of member dependency groups scoped to
  // its own workspace root so the lockfile parser can prune dev-only dependencies of workspace
  // packages consumed as production deps. Done before the main loop because a consumer (e.g.
  // apps/my-app) may be processed before the member it depends on (e.g. libraries/shared-lib).
  const manifestsByDir = collectWorkspaceManifestsByDir(root, yarnTargetFiles);

  let rootWorkspaceManifestContent = {};
  // the folders must be ordered highest first
  for (const directory of Object.keys(yarnTargetFiles)) {
    debug(`Processing ${directory} as a potential Yarn workspace`);
    let isYarnWorkspacePackage = false;
    let isRootPackageJson = false;
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const cachedManifest = manifestsByDir.get(directory);
    const packageJson = cachedManifest
      ? { content: cachedManifest.content, fileName: cachedManifest.fileName }
      : getFileContents(root, packageJsonFileName);
    yarnWorkspacesMap = {
      ...yarnWorkspacesMap,
      ...getWorkspacesMap(packageJson),
    };

    for (const workspaceRoot of Object.keys(yarnWorkspacesMap)) {
      const match = packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      );
      if (match) {
        debug(`${packageJsonFileName} matches an existing workspace pattern`);
        yarnWorkspacesFilesMap[packageJsonFileName] = {
          root: workspaceRoot,
        };
        isYarnWorkspacePackage = true;
      }
      if (packageJsonFileName === workspaceRoot) {
        isRootPackageJson = true;
        rootWorkspaceManifestContent = JSON.parse(packageJson.content);
      }
    }

    if (!(isYarnWorkspacePackage || isRootPackageJson)) {
      debug(
        `${packageJsonFileName} is not part of any detected workspace, skipping`,
      );
      continue;
    }

    try {
      const rootDir = isYarnWorkspacePackage
        ? pathUtil.dirname(yarnWorkspacesFilesMap[packageJsonFileName].root)
        : pathUtil.dirname(packageJsonFileName);
      const rootYarnLockfileName = pathUtil.join(rootDir, 'yarn.lock');
      const yarnLock = getFileContents(root, rootYarnLockfileName);
      const lockfileVersion = lockFileParser.getYarnLockfileVersion(
        yarnLock.content,
      );

      let res: DepGraph;
      switch (lockfileVersion) {
        case lockFileParser.NodeLockfileVersion.YarnLockV1:
          res = await lockFileParser.parseYarnLockV1Project(
            packageJson.content,
            yarnLock.content,
            {
              includeDevDeps: settings.dev || false,
              includeOptionalDeps: false,
              includePeerDeps: false,
              pruneLevel: 'withinTopLevelDeps',
              strictOutOfSync:
                settings.strictOutOfSync === undefined
                  ? true
                  : settings.strictOutOfSync,
              showNpmScope: settings.showNpmScope,
            },
          );
          break;
        case lockFileParser.NodeLockfileVersion.YarnLockV2:
          res = await lockFileParser.parseYarnLockV2Project(
            packageJson.content,
            yarnLock.content,
            {
              includeDevDeps: settings.dev || false,
              includeOptionalDeps: false,
              pruneWithinTopLevelDeps: true,
              strictOutOfSync:
                settings.strictOutOfSync === undefined
                  ? true
                  : settings.strictOutOfSync,
              showNpmScope: settings.showNpmScope,
            },
            {
              isWorkspacePkg: true,
              isRoot: isRootPackageJson,
              rootResolutions:
                rootWorkspaceManifestContent?.['resolutions'] || {},
              // Scope the member manifests to this package's own workspace root, so a
              // same-named package in a different workspace cannot prune this node.
              workspacePackages: workspacePackagesUnderRoot(
                manifestsByDir,
                rootDir,
              ),
            },
          );
          break;
        default:
          throw new Error('Failed to build dep graph from current project');
      }
      const project: ScannedProjectCustom = {
        packageManager: 'yarn',
        targetFile: pathUtil.relative(root, packageJson.fileName),
        depGraph: res as any,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    } catch (e) {
      if (settings.yarnWorkspaces) {
        throw e;
      }
      debug(`Error process workspace: ${packageJsonFileName}. ERROR: ${e}`);
    }
  }
  if (!result.scannedProjects.length) {
    debug(
      `No yarn workspaces detected in any of the ${targetFiles.length} target files.`,
    );
  }
  return result;
}
