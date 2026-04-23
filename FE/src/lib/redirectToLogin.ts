/**
 * redirectToLogin — helper dùng chung cho mọi trang cần auth.
 *
 * Lưu `from` vào cả state (không mất khi SPA navigate) và
 * localStorage (fallback khi user refresh trang login).
 *
 * Dùng:
 *   import { redirectToLogin } from '../lib/redirectToLogin';
 *   redirectToLogin(navigate, location);
 */
import type { NavigateFunction, Location } from 'react-router-dom';

export function redirectToLogin(
  navigate: NavigateFunction,
  location: Location,
  extra?: Record<string, unknown>,
) {
  const from = location.pathname + location.search;

  // Lưu localStorage để tồn tại qua refresh
  localStorage.setItem('redirectAfterLogin', from);

  navigate('/login', {
    replace: false,
    state: { from, ...extra },
  });
}
