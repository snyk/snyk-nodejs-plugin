import * as path from 'path';
import * as fs from 'fs';
import * as resolveNodeDeps from 'snyk-resolve-deps';
import * as baseDebug from 'debug';
import { isEmpty } from 'lodash';
import { Options } from './types';
import { getFileContents } from './utils';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';

const debug = baseDebug('snyk-nodejs-plugin');

export async function parse(
  root: string,
  targetFile: string,
  options: Options,
): Promise<PkgTree> {
  if (targetFile.endsWith('yarn.lock')) {
    options.file =
      options.file && options.file.replace('yarn.lock', 'package.json');
  }

  if (targetFile.endsWith('pnpm-lock.yaml')) {
    options.file =
      options.file && options.file.replace('pnpm-lock.yaml', 'package.json');
  }

  // package-lock.json falls back to package.json (used in wizard code)
  if (targetFile.endsWith('package-lock.json')) {
    options.file =
      options.file && options.file.replace('package-lock.json', 'package.json');
  }
  // check if there any dependencies
  const packageJsonFileName = path.resolve(root, options.file!);
  const packageManager = options.packageManager || 'npm';

  try {
    const packageJson = JSON.parse(
      getFileContents(root, packageJsonFileName).content,
    );

    let dependencies = packageJson.dependencies;
    if (options.dev) {
      dependencies = { ...dependencies, ...packageJson.devDependencies };
    }
    if (isEmpty(dependencies)) {
      return new Promise((resolve) =>
        resolve({
          name: packageJson.name || 'package.json',
          dependencies: {},
          version: packageJson.version,
        }),
      );
    }
  } catch (e: any) {
    debug(`Failed to read ${packageJsonFileName}: Error: ${e}`);
    throw new Error(
      `Failed to read ${packageJsonFileName}. Error: ${e.message}`,
    );
  }
  const nodeModulesPath = path.join(
    path.dirname(path.resolve(root, targetFile)),
    'node_modules',
  );

  if (!fs.existsSync(nodeModulesPath)) {
    // throw a custom error
    throw new Error(
      "Missing node_modules folder: we can't test " +
        `without dependencies.\nPlease run '${packageManager} install' first.`,
    );
  }
  return resolveNodeDeps(
    root,
    Object.assign({}, options, { noFromArrays: true }),
  );
}
