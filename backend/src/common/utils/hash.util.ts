import * as bcrypt from 'bcrypt';

export function hash(value: string, saltRounds: number): Promise<string> {
  return bcrypt.hash(value, saltRounds);
}

export function compare(value: string, digest: string): Promise<boolean> {
  return bcrypt.compare(value, digest);
}
