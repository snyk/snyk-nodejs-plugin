import * as fs from 'fs';
import * as path from 'path';

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
