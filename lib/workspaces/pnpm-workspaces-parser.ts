import * as debugModule from 'debug';
import * as pathUtil from 'path';
import * as fs from 'fs';

const debug = debugModule('snyk-pnpm-workspaces');
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { MultiProjectResultCustom, ScannedProjectCustom } from '../types';
import { sortTargetFiles } from './workspace-utils';
import { ScannedNodeProject } from 'snyk-nodejs-lockfile-parser/dist/dep-graph-builders/types';

export async function processPnpmWorkspaces(
  root: string,
  settings: {
    strictOutOfSync?: boolean;
    dev?: boolean;
    optional?: boolean;
  },
  targetFiles: string[],
): Promise<MultiProjectResultCustom> {
  const pnpmWorkspaceDirs = sortTargetFiles(targetFiles, ['pnpm-lock.yaml']);

  debug(`Processing potential Pnpm workspaces (${targetFiles.length})`);

  const result: MultiProjectResultCustom = {
    plugin: {
      name: 'snyk-nodejs-pnpm-workspaces',
      runtime: process.version,
    },
    scannedProjects: [],
  };

  // the folders must be ordered highest first
  for (const directory of Object.keys(pnpmWorkspaceDirs)) {
    debug(`Processing ${directory} as a potential Pnpm workspace`);

    const pnpmWorkspacePath = pathUtil.join(directory, 'pnpm-workspace.yaml');
    if (!fs.existsSync(pnpmWorkspacePath)) {
      debug(
        `Workspace file not found at ${directory}. Can't be a pnpm workspace root.`,
      );
      continue;
    }

    const scannedProjects: ScannedNodeProject[] =
      await lockFileParser.parsePnpmWorkspace(root, directory, {
        includeDevDeps: settings.dev || false,
        includeOptionalDeps: settings.optional || true,
        includePeerDeps: true,
        pruneWithinTopLevelDeps: true,
        strictOutOfSync:
          settings.strictOutOfSync === undefined
            ? true
            : settings.strictOutOfSync,
      });
    result.scannedProjects = result.scannedProjects.concat(
      scannedProjects as ScannedProjectCustom[],
    );
  }

  if (!result.scannedProjects.length) {
    debug(
      `No pnpm workspaces detected in any of the ${targetFiles.length} target files.`,
    );
  }

  return result;
}
