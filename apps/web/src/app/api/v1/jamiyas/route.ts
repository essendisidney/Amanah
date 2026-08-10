/**
 * Compatibility shim: /api/v1/jamiyas → /api/v1/circles
 * Prefer /api/v1/circles for new clients.
 */
export { GET, POST } from '../circles/route';
