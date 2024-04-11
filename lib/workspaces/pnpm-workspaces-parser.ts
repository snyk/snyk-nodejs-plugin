import * as debugModule from 'debug';
import * as pathUtil from 'path';

const debug = debugModule('snyk-pnpm-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { MultiProjectResultCustom, ScannedProjectCustom } from '../types';
import { getFileContents, isSubpath, normalizeFilePath } from '../utils';
import {
  getWorkspacesMap,
  packageJsonBelongsToWorkspace,
  sortTargetFiles,
} from './workspace-utils';
import { DepGraph } from '@snyk/dep-graph';

const PNPM_ROOT_FILES = [
  'pnpm-workspace.yaml',
  'package.json',
  'pnpm-lock.yaml',
];

// Compute project versions map
// This is needed because the lockfile doesn't present the version of
// a project that's part of a workspace, we need to retrieve it from
// its corresponding package.json
function computeProjectVersionMaps(root: string, targetFiles) {
  const projectsVersionMap = {};
  for (const directory of Object.keys(targetFiles)) {
    if (!isSubpath(directory, root)) {
      continue;
    }
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);

    try {
      const parsedPkgJson = lockFileParser.parsePkgJson(packageJson.content);
      const projectVersion = parsedPkgJson.version;
      projectsVersionMap[
        normalizeFilePath(pathUtil.relative(root, directory))
      ] = projectVersion;
    } catch (err: any) {
      debug(
        `Error getting version for project: ${packageJsonFileName}. ERROR: ${err}`,
      );
      continue;
    }
  }
  return projectsVersionMap;
}

export async function processPnpmWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
    optional?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const pnpmTargetFiles = sortTargetFiles(targetFiles, PNPM_ROOT_FILES);

  debug(`Processing potential Pnpm workspaces (${targetFiles.length})`);

  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-pnpm-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };

  let pnpmWorkspacesMap = {};
  const pnpmWorkspacesFilesMap = {};

  let rootWorkspaceManifestContent = {};
  const projectsVersionMap = {};

  // the folders must be ordered highest first
  for (const directory of Object.keys(pnpmTargetFiles)) {
    debug(`Processing ${directory} as a potential Pnpm workspace`);
    let isPnpmWorkspacePackage = false;
    let isRootPackageJson = false;
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    const packageJson = getFileContents(root, packageJsonFileName);
    pnpmWorkspacesMap = {
      ...pnpmWorkspacesMap,
      ...getWorkspacesMap(root, directory, packageJson),
    };

    for (const workspaceRoot of Object.keys(pnpmWorkspacesMap)) {
      const match = packageJsonBelongsToWorkspace(
        packageJsonFileName,
        pnpmWorkspacesMap,
        workspaceRoot,
      );
      if (match) {
        debug(`${packageJsonFileName} matches an existing workspace pattern`);
        pnpmWorkspacesFilesMap[packageJsonFileName] = {
          root: workspaceRoot,
        };
        isPnpmWorkspacePackage = true;
      }
      if (packageJsonFileName === workspaceRoot) {
        isRootPackageJson = true;
        const workspaceRootDir = pathUtil.dirname(workspaceRoot);
        projectsVersionMap[workspaceRootDir] = computeProjectVersionMaps(
          workspaceRootDir,
          pnpmTargetFiles,
        );
        rootWorkspaceManifestContent = JSON.parse(packageJson.content);
      }
    }

    if (!(isPnpmWorkspacePackage || isRootPackageJson)) {
      debug(
        `${packageJsonFileName} is not part of any detected workspace, skipping`,
      );
      continue;
    }

    const rootDir = isPnpmWorkspacePackage
      ? pathUtil.dirname(pnpmWorkspacesFilesMap[packageJsonFileName].root)
      : pathUtil.dirname(packageJsonFileName);

    try {
      const rootPnpmLockfileName = pathUtil.join(rootDir, 'pnpm-lock.yaml');
      const pnpmLock = getFileContents(root, rootPnpmLockfileName);
      const lockfileVersion = lockFileParser.getPnpmLockfileVersion(
        pnpmLock.content,
      );
      const res: DepGraph = await lockFileParser.parsePnpmProject(
        packageJson.content,
        pnpmLock.content,
        {
          includeDevDeps: settings.dev || false,
          includeOptionalDeps: settings.optional || false,
          pruneWithinTopLevelDeps: true,
          strictOutOfSync:
            settings.strictOutOfSync === undefined
              ? true
              : settings.strictOutOfSync,
        },
        lockfileVersion,
        {
          isWorkspacePkg: true,
          workspacePath: normalizeFilePath(
            pathUtil.relative(rootDir, directory),
          ),
          isRoot: isRootPackageJson,
          projectsVersionMap: projectsVersionMap[rootDir],
          rootOverrides: rootWorkspaceManifestContent?.['pnpm.overrides'] || {},
        },
      );
      const project: ScannedProjectCustom = {
        packageManager: 'pnpm',
        targetFile: pathUtil.relative(rootDir, packageJson.fileName),
        depGraph: res as any,
        plugin: {
          name: 'snyk-nodejs-lockfile-parser',
          runtime: process.version,
        },
      };
      result.scannedProjects.push(project);
    } catch (e) {
      debug(`Error process workspace: ${packageJsonFileName}. ERROR: ${e}`);
    }
  }

  if (!result.scannedProjects.length) {
    debug(
      `No pnpm workspaces detected in any of the ${targetFiles.length} target files.`,
    );
  }

  return result;
}
