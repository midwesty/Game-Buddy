export function encodeMatch(match) {
  const json = JSON.stringify(match);
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeMatch(code) {
  const json = decodeURIComponent(escape(atob(code.trim())));
  return JSON.parse(json);
}
