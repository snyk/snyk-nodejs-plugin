export class CustomError extends Error {
  public innerError;
  public code: number | undefined;
  public userMessage: string | undefined;
  public strCode: string | undefined;

  constructor(message: string) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.code = undefined;
    this.strCode = undefined;
    this.innerError = undefined;
    this.userMessage = undefined;
  }
}

export function MissingTargetFileError(path: string) {
  const errorMsg =
    `Not a recognised option did you mean --file=${path}? ` +
    'Check other options by running snyk --help';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function NoSupportedManifestsFoundError(
  atLocations: string[],
): CustomError {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    'Could not detect supported target files in ' +
    locationsStr +
    '.\nPlease see our documentation for supported languages and ' +
    'target files: https://snyk.co/udVgQ' +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}
