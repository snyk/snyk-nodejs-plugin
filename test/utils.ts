/* eslint-disable no-console, @typescript-eslint/no-non-null-assertion */
import * as path from 'path';

export function chdirFixtures(dir: string) {
  process.chdir(path.resolve(__dirname, 'fixtures', dir));
}
