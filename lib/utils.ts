import * as fs from 'fs';
import * as path from 'path';
import { DepGraph } from '@snyk/dep-graph';
import { PkgTree } from 'snyk-nodejs-lockfile-parser';

export function getFileContents(
  root: string,
  fileName: string,
): {
  content: string;
  fileName: string;
} {
  const fullPath = path.resolve(root, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      'Manifest ' + fileName + ' not found at location: ' + fileName,
    );
  }
  const content = fs.readFileSync(fullPath, 'utf-8');
  return {
    content,
    fileName,
  };
}

export function fileExists(root: string, fileName: string): boolean {
  const fullPath = path.resolve(root, fileName);
  return fs.existsSync(fullPath);
}

export function isResDepGraph(depRes: PkgTree | DepGraph): depRes is DepGraph {
  return 'rootPkg' in depRes;
}

export function normalizeFilePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

export function isSubpath(subpath: string, parentPath: string): boolean {
  // Normalize both paths (ensure consistent separators)
  const normalizedSubpath = normalizeFilePath(subpath);
  const normalizedParentPath = normalizeFilePath(parentPath);

  // Ensure subpath starts with parent path
  return (
    normalizedSubpath == normalizedParentPath ||
    normalizedSubpath.startsWith(`${normalizedParentPath}/`)
  );
}
