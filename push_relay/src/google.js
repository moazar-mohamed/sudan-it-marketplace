// Talks to Google on the relay's behalf: turns the service account into an
// access token, and reads/writes Firestore over REST. Works the same on
// Cloudflare Workers and Node (both have fetch and WebCrypto).

const TOKEN_SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase.messaging',
].join(' ');

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * An OAuth access token for the service account, reused until a minute
 * before it expires (one RSA signature per hour, not per request).
 */
export function createTokenSource(serviceAccount, { fetch, now }) {
  let cached = null;
  return async function accessToken() {
    const seconds = Math.floor(now() / 1000);
    if (cached && cached.expiresAt - 60 > seconds) return cached.token;
    const audience = serviceAccount.token_uri || 'https://oauth2.googleapis.com/token';
    const encode = (value) => base64Url(new TextEncoder().encode(JSON.stringify(value)));
    const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
      iss: serviceAccount.client_email,
      scope: TOKEN_SCOPES,
      aud: audience,
      iat: seconds,
      exp: seconds + 3600,
    })}`;
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(serviceAccount.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      key,
      new TextEncoder().encode(unsigned),
    );
    const response = await fetch(audience, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:
        'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer' +
        `&assertion=${unsigned}.${base64Url(new Uint8Array(signature))}`,
    });
    if (!response.ok) {
      throw new Error(`token exchange failed: ${response.status}`);
    }
    const body = await response.json();
    cached = { token: body.access_token, expiresAt: seconds + (body.expires_in ?? 3600) };
    return cached.token;
  };
}

// ── Firestore values ────────────────────────────────────────────────────────

export function decodeValue(value) {
  if (value == null) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return new Date(value.timestampValue);
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ('mapValue' in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

export function decodeFields(fields) {
  return Object.fromEntries(
    Object.entries(fields ?? {}).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)])),
    },
  };
}

/**
 * Firestore over REST with admin rights (security rules do not apply).
 * Against the emulator it uses the emulator's "owner" token instead.
 */
export function createFirestore({ projectId, emulatorHost, accessToken, fetch }) {
  const root = emulatorHost
    ? `http://${emulatorHost}/v1`
    : 'https://firestore.googleapis.com/v1';
  const database = `projects/${projectId}/databases/(default)`;
  const documents = `${root}/${database}/documents`;

  async function headers() {
    const token = emulatorHost ? 'owner' : await accessToken();
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  return {
    documentName: (path) => `${database}/documents/${path}`,

    /** The document's fields, or null when it does not exist. */
    async get(path) {
      const response = await fetch(`${documents}/${path}`, { headers: await headers() });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`firestore get ${path}: ${response.status}`);
      return decodeFields((await response.json()).fields);
    },

    /** Documents of [collection] whose fields equal every value in [equals]. */
    async where(collection, equals) {
      const filters = Object.entries(equals).map(([field, value]) => ({
        fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encodeValue(value) },
      }));
      const response = await fetch(`${documents}:runQuery`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collection }],
            where: filters.length === 1
              ? filters[0]
              : { compositeFilter: { op: 'AND', filters } },
          },
        }),
      });
      if (!response.ok) throw new Error(`firestore query ${collection}: ${response.status}`);
      const rows = await response.json();
      return rows
        .filter((row) => row.document)
        .map((row) => ({
          id: row.document.name.split('/').pop(),
          ...decodeFields(row.document.fields),
        }));
    },

    /**
     * Creates the document only if it does not exist yet. Returns false when
     * it already did (someone else got there first).
     */
    async createOnce(path, data) {
      const response = await fetch(`${documents}:commit`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          writes: [{
            update: {
              name: `${database}/documents/${path}`,
              fields: encodeValue(data).mapValue.fields,
            },
            currentDocument: { exists: false },
          }],
        }),
      });
      if (response.ok) return true;
      if (response.status === 409 || response.status === 400) {
        const status = (await response.json().catch(() => ({})))?.error?.status;
        if (status === 'ALREADY_EXISTS' || status === 'FAILED_PRECONDITION') return false;
      }
      throw new Error(`firestore create ${path}: ${response.status}`);
    },

    /** Merges [data] into an existing document. */
    async merge(path, data) {
      const response = await fetch(
        `${documents}/${path}?${Object.keys(data)
          .map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`)
          .join('&')}`,
        {
          method: 'PATCH',
          headers: await headers(),
          body: JSON.stringify({ fields: encodeValue(data).mapValue.fields }),
        },
      );
      if (!response.ok) throw new Error(`firestore merge ${path}: ${response.status}`);
    },

    /** Removes [values] from the array field [field] of the document. */
    async removeFromArray(path, field, values) {
      const response = await fetch(`${documents}:commit`, {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          writes: [{
            transform: {
              document: `${database}/documents/${path}`,
              fieldTransforms: [{
                fieldPath: field,
                removeAllFromArray: { values: values.map(encodeValue) },
              }],
            },
          }],
        }),
      });
      if (!response.ok) throw new Error(`firestore array remove ${path}: ${response.status}`);
    },
  };
}
