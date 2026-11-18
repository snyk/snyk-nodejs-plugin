import * as path from 'path';
import * as fs from 'fs';
import { load as loadYaml } from 'js-yaml';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import {
  NodeLockfileVersion,
  InvalidUserInputError,
  ProjectParseOptions,
} from 'snyk-nodejs-lockfile-parser';
import { DepGraph } from '@snyk/dep-graph';
import * as baseDebug from 'debug';

const debug = baseDebug('snyk-nodejs-plugin');

// pnpm-workspace.yaml can exist only for pnpm settings (onlyBuiltDependencies,
// neverBuiltDependencies, and similar). Those files have no `packages` list.
// A single-project scan is valid unless the file actually names workspace packages.
export function pnpmWorkspaceDefinesPackages(content: string): boolean {
  if (content.trim() === '') {
    return false;
  }

  let document: unknown;
  try {
    document = loadYaml(content);
  } catch {
    // Unreadable YAML keeps the previous refusal, so a real workspace is not scanned as one project.
    return true;
  }

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return false;
  }

  const packages = (document as { packages?: unknown }).packages;
  return Array.isArray(packages) && packages.length > 0;
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

  if (
    options.includeComponentMetadata &&
    lockfileVersion !== NodeLockfileVersion.NpmLockV2 &&
    lockfileVersion !== NodeLockfileVersion.NpmLockV3 &&
    lockfileVersion !== NodeLockfileVersion.YarnLockV1
  ) {
    debug(
      `includeComponentMetadata is set but component-metadata labels ` +
        `(package hashes / distribution URLs) are not yet produced for ` +
        `lockfile version ${lockfileVersion}; ` +
        `only npm package-lock v2/v3 and yarn.lock v1 are supported ` +
        `(yarn berry is deferred)`,
    );
  }

  switch (lockfileVersion) {
    case NodeLockfileVersion.PnpmLockV5:
    case NodeLockfileVersion.PnpmLockV6:
    case NodeLockfileVersion.PnpmLockV9:
      if (
        fs.existsSync(workspaceFileFullPath) &&
        pnpmWorkspaceDefinesPackages(
          fs.readFileSync(workspaceFileFullPath, 'utf-8'),
        )
      ) {
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
          includeComponentMetadata: options.includeComponentMetadata || false,
        },
      );
    case NodeLockfileVersion.YarnLockV2:
      return await lockFileParser.parseYarnLockV2Project(
        manifestFileContents,
        lockFileContents,
        {
          includeDevDeps: options.includeDevDeps,
          includeOptionalDeps: options.includeOptionalDeps,
          pruneWithinTopLevelDeps: true,
          strictOutOfSync: options.strictOutOfSync,
          // Threaded for a uniform API; berry component-metadata labels are deferred (no-op).
          includeComponentMetadata: options.includeComponentMetadata || false,
        },
      );
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
