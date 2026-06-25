import * as debugModule from 'debug';
import * as fs from 'fs';
import * as pathUtil from 'path';
import * as lockFileParser from 'snyk-nodejs-lockfile-parser';
import { WorkspacePackageManifest } from 'snyk-nodejs-lockfile-parser';
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

export interface WorkspaceManifestEntry {
  content: string;
  fileName: string;
  name?: string;
  manifest: WorkspacePackageManifest;
}

/**
 * Read each workspace directory's package.json once, indexed by directory.
 *
 * Yarn Berry merges a workspace member's dependencies + devDependencies into a single
 * `dependencies` block in yarn.lock, dropping the dev marker. Retaining each member's own
 * dependency groups (scoped per workspace root by {@link workspacePackagesUnderRoot}) lets the
 * lockfile parser re-derive which transitive deps of a consumed workspace package are dev-only
 * and prune them from the production graph. Reading by directory also lets callers reuse the
 * contents instead of re-reading from disk. Unreadable/non-JSON manifests are skipped.
 */
export function collectWorkspaceManifestsByDir(
  root: string,
  yarnTargetFiles: { [dir: string]: unknown },
): Map<string, WorkspaceManifestEntry> {
  const manifestsByDir = new Map<string, WorkspaceManifestEntry>();
  for (const directory of Object.keys(yarnTargetFiles)) {
    const packageJsonFileName = pathUtil.join(directory, 'package.json');
    try {
      const file = getFileContents(root, packageJsonFileName);
      const pkg = JSON.parse(file.content);
      manifestsByDir.set(directory, {
        content: file.content,
        fileName: file.fileName,
        name: pkg?.name,
        manifest: {
          dependencies: pkg?.dependencies,
          devDependencies: pkg?.devDependencies,
          optionalDependencies: pkg?.optionalDependencies,
          peerDependencies: pkg?.peerDependencies,
        },
      });
    } catch (e: any) {
      debug(`Could not read package.json in ${directory}: ${e.message}`);
    }
  }
  return manifestsByDir;
}

/**
 * Build the name -> dependency-groups map for members of a single workspace root, identified
 * by their package.json living under `rootDir`. Scoping to one root prevents a same-named
 * package from a different workspace (in the same scan) from being used to prune this
 * workspace's nodes.
 */
export function workspacePackagesUnderRoot(
  manifestsByDir: Map<string, WorkspaceManifestEntry>,
  rootDir: string,
): Record<string, WorkspacePackageManifest> {
  const workspacePackages: Record<string, WorkspacePackageManifest> = {};
  for (const [dir, entry] of manifestsByDir) {
    if (!entry.name) {
      continue;
    }
    const rel = pathUtil.relative(rootDir, dir);
    const underRoot =
      rel === '' || (!rel.startsWith('..') && !pathUtil.isAbsolute(rel));
    if (underRoot) {
      workspacePackages[entry.name] = entry.manifest;
    }
  }
  return workspacePackages;
}

/**
 * Build a map of workspace package name -> its package.json dependency groups from raw
 * manifest contents. Used by the single-root `--all-projects` path, which already discovers
 * exactly one workspace's manifests.
 */
export function collectYarnWorkspacePackages(
  manifestContents: string[],
): Record<string, WorkspacePackageManifest> {
  const workspacePackages: Record<string, WorkspacePackageManifest> = {};
  for (const content of manifestContents) {
    try {
      const pkg = JSON.parse(content);
      if (!pkg || !pkg.name) {
        continue;
      }
      workspacePackages[pkg.name] = {
        dependencies: pkg.dependencies,
        devDependencies: pkg.devDependencies,
        optionalDependencies: pkg.optionalDependencies,
        peerDependencies: pkg.peerDependencies,
      };
    } catch (e: any) {
      debug('Failed to parse a workspace package.json', e.message);
    }
  }
  return workspacePackages;
}

/**
 * Recursively collect package.json file paths under `dir`, skipping node_modules and dotted
 * directories. Bounded by `maxDepth` to avoid pathological deep trees.
 */
function findPackageJsonFiles(dir: string, depth = 0, maxDepth = 8): string[] {
  if (depth > maxDepth) {
    return [];
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e: any) {
    debug(`Failed to read directory ${dir}`, e.message);
    return [];
  }
  let results: string[] = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
      continue;
    }
    const full = pathUtil.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findPackageJsonFiles(full, depth + 1, maxDepth));
    } else if (entry.name === 'package.json') {
      results.push(full);
    }
  }
  return results;
}

/**
 * For a Yarn workspace root directory, return the package.json contents of the root plus
 * every workspace member (resolved from the root's `workspaces` globs). Returns an empty
 * array when `workspaceRootDir` is not a workspace root, so callers can treat "no workspaces"
 * as a no-op. Used to feed {@link collectYarnWorkspacePackages} on the `--all-projects` path
 * where sibling manifests are not otherwise loaded.
 */
export function discoverYarnWorkspaceManifestContents(
  workspaceRootDir: string,
): string[] {
  const rootPkgJsonPath = pathUtil.join(workspaceRootDir, 'package.json');
  if (!fs.existsSync(rootPkgJsonPath)) {
    return [];
  }

  let rootContent: string;
  let workspaceGlobs: string[];
  try {
    rootContent = fs.readFileSync(rootPkgJsonPath, 'utf-8');
    workspaceGlobs = lockFileParser.getYarnWorkspaces(rootContent) || [];
  } catch (e: any) {
    debug('Failed to read workspace root package.json', e.message);
    return [];
  }

  if (!workspaceGlobs.length) {
    return [];
  }

  const memberGlobs = workspaceGlobs.map((workspace) =>
    normalizeFilePath(pathUtil.join(workspaceRootDir, workspace, '**')),
  );

  const manifestContents: string[] = [rootContent];
  for (const pkgJsonPath of findPackageJsonFiles(workspaceRootDir)) {
    if (!micromatch.isMatch(normalizeFilePath(pkgJsonPath), memberGlobs)) {
      continue;
    }
    try {
      manifestContents.push(fs.readFileSync(pkgJsonPath, 'utf-8'));
    } catch (e: any) {
      debug(`Failed to read workspace member ${pkgJsonPath}`, e.message);
    }
  }
  return manifestContents;
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
