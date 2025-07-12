export function parseJwt(token: string): any {
  try {
    const base64 = token.split('.')[1];
    const decoded = Buffer.from(base64, 'base64').toString();
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Failed to parse JWT", e);
    return {};
  }
}
