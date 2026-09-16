export class ObjectStorageUnavailableError extends Error {
  constructor() {
    super('Object storage is not enabled.');
    this.name = 'ObjectStorageUnavailableError';
  }
}
