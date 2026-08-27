interface ResponseWithSetCookies {
  headers: {
    'set-cookie'?: unknown;
  };
}

export function findSetCookie(
  response: ResponseWithSetCookies,
  name: string,
): string {
  const setCookies = response.headers['set-cookie'];
  if (!Array.isArray(setCookies)) {
    throw new Error(`Missing ${name} cookie.`);
  }

  const cookie = setCookies.find(
    (value): value is string =>
      typeof value === 'string' && value.startsWith(`${name}=`),
  );
  if (!cookie) {
    throw new Error(`Missing ${name} cookie.`);
  }

  return cookie;
}

export function cookiePair(setCookie: string): string {
  const [pair] = setCookie.split(';', 1);
  if (!pair || !pair.includes('=')) {
    throw new Error('Invalid Set-Cookie header.');
  }

  return pair;
}

export function cookieValue(setCookie: string, name: string): string {
  const pair = cookiePair(setCookie);
  const prefix = `${name}=`;
  if (!pair.startsWith(prefix)) {
    throw new Error(`Cookie is not ${name}.`);
  }

  return pair.slice(prefix.length);
}
