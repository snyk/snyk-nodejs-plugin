import * as cliInterface from '@snyk/cli-interface';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';
import { CallGraph } from '@snyk/cli-interface/legacy/common';

export type SupportedPackageManagers = 'npm' | 'yarn' | 'pnpm';

export interface Options {
  file?: string;
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean;
  allSubProjects?: boolean;
  debug?: boolean;
  packageManager?: string;
  composerIsFine?: boolean;
  composerPharIsFine?: boolean;
  systemVersions?: object;
  scanAllUnmanaged?: boolean;
}

export interface ScannedProjectCustom
  extends cliInterface.legacyCommon.ScannedProject {
  packageManager: SupportedPackageManagers;
  plugin: PluginMetadata;
  callGraph?: CallGraph;
}

interface FailedProjectScanError {
  targetFile?: string;
  error?: Error;
  errMessage: string;
}

export interface MultiProjectResultCustom
  extends cliInterface.legacyPlugin.MultiProjectResult {
  scannedProjects: ScannedProjectCustom[];
  failedResults?: FailedProjectScanError[];
}
