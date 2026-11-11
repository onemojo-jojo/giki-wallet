export { Navbar } from './Navbar';
// Explicit './navbar/index' — './navbar' collides with './Navbar' on case-insensitive filesystems (Windows/macOS).
export { ClientNavbar, AdminNavbar } from './navbar/index';
export type { NavItem } from './navbar/index';
export { Footer } from './Footer';

