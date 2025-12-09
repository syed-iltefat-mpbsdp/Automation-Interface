
export function normalizeAndValidateUrl(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length === 0) return null;

  // add trailing slash if missing
  const withSlash = s.endsWith('/') ? s : s + '/';

  // basic validation using the URL constructor
  try {
    const u = new URL(withSlash);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return withSlash;
  } catch (e) {
    return null;
  }
}

// store (string or object)
export function setLocal(name, value) {
  const v = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(name, v);
}

// read (returns string or parsed object if JSON)
export function getLocal(name) {
  const v = localStorage.getItem(name);
  if (v === null) return null;
  try {
    return JSON.parse(v);
  } catch (e) {
    return v;
  }
}

// delete
export function deleteLocal(name) {
  localStorage.removeItem(name);
}
