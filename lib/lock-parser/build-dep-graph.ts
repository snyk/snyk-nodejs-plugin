import * as path from 'path';
import * as fs from 'fs';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import {
  NodeLockfileVersion,
  InvalidUserInputError,
  ProjectParseOptions,
} from 'snyk-nodejs-lockfile-parser';
import { DepGraph } from '@snyk/dep-graph';
import {
  collectYarnWorkspacePackages,
  discoverYarnWorkspaceManifestContents,
} from '../workspaces/workspace-utils';

function parseResolutions(pkgJsonContent: string): Record<string, string> {
  try {
    return JSON.parse(pkgJsonContent).resolutions || {};
  } catch {
    return {};
  }
}

export async function buildDepGraph(
  root: string,
  manifestFilePath: string,
  lockfilePath: string,
  lockfileVersion: NodeLockfileVersion,
  options: ProjectParseOptions,
): Promise<DepGraph> {
  const manifestFileFullPath = path.resolve(root, manifestFilePath);
  const lockFileFullPath = path.resolve(root, lockfilePath);

  if (!fs.existsSync(manifestFileFullPath)) {
    throw new InvalidUserInputError(
      'Target file package.json not found at ' +
        `location: ${manifestFileFullPath}`,
    );
  }
  if (!fs.existsSync(lockFileFullPath)) {
    throw new InvalidUserInputError(
      'Lockfile not found at location: ' + lockFileFullPath,
    );
  }

  const manifestFileContents = fs.readFileSync(manifestFileFullPath, 'utf-8');
  const lockFileContents = fs.readFileSync(lockFileFullPath, 'utf-8');

  const workspaceRootPath = path.parse(lockFileFullPath).dir;
  const workspaceFileFullPath = path.resolve(
    workspaceRootPath,
    'pnpm-workspace.yaml',
  );

  switch (lockfileVersion) {
    case NodeLockfileVersion.PnpmLockV5:
    case NodeLockfileVersion.PnpmLockV6:
    case NodeLockfileVersion.PnpmLockV9:
      if (fs.existsSync(workspaceFileFullPath)) {
        throw new InvalidUserInputError(
          'Both `pnpm-lock.yaml` and `pnpm-workspace.yaml` were found in ' +
            workspaceRootPath +
            '.\n' +
            'Please run your command again specifying `--all-projects` flag.',
        );
      }
      return await lockFileParser.parsePnpmProject(
        manifestFileContents,
        lockFileContents,
        {
          includeDevDeps: options.includeDevDeps,
          includeOptionalDeps: options.includeOptionalDeps || true,
          includePeerDeps: true,
          pruneWithinTopLevelDeps: true,
          strictOutOfSync: options.strictOutOfSync,
        },
        lockfileVersion,
      );
    case NodeLockfileVersion.YarnLockV1:
      return await lockFileParser.parseYarnLockV1Project(
        manifestFileContents,
        lockFileContents,
        {
          includeDevDeps: options.includeDevDeps,
          includeOptionalDeps: options.includeOptionalDeps,
          includePeerDeps: options.includePeerDeps || false,
          pruneLevel: 'withinTopLevelDeps',
          strictOutOfSync: options.strictOutOfSync,
        },
      );
    case NodeLockfileVersion.YarnLockV2: {
      // When the project is a Yarn workspace root, give the parser every member's
      // package.json so it can prune dev-only deps of workspace packages consumed as prod
      // deps. Non-workspace projects yield an empty map and behave exactly as before.
      const workspacePackages = collectYarnWorkspacePackages(
        discoverYarnWorkspaceManifestContents(workspaceRootPath),
      );
      const yarnV2WorkspaceArgs = Object.keys(workspacePackages).length
        ? {
            isWorkspacePkg: false,
            isRoot: true,
            rootResolutions: parseResolutions(manifestFileContents),
            workspacePackages,
          }
        : undefined;
      return await lockFileParser.parseYarnLockV2Project(
        manifestFileContents,
        lockFileContents,
        {
          includeDevDeps: options.includeDevDeps,
          includeOptionalDeps: options.includeOptionalDeps,
          pruneWithinTopLevelDeps: true,
          strictOutOfSync: options.strictOutOfSync,
        },
        yarnV2WorkspaceArgs,
      );
    }
    case NodeLockfileVersion.NpmLockV2:
    case NodeLockfileVersion.NpmLockV3:
      return await lockFileParser.parseNpmLockV2Project(
        manifestFileContents,
        lockFileContents,
        options,
      );
    default:
      throw new Error('Failed to build dep graph from current project');
  }
}
