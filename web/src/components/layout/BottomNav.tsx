'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Flame, Map, Heart, Menu } from 'lucide-react';
import { useFavorites } from '@/contexts/favorites-context';

interface NavItem {
  href: string;
  label: string;
  labelHe: string;
  icon: React.ReactNode;
  badge?: number;
}

export function BottomNav() {
  const pathname = usePathname();
  const { favorites } = useFavorites();

  const navItems: NavItem[] = [
    {
      href: '/',
      label: 'Home',
      labelHe: 'בית',
      icon: <Home className="w-6 h-6" />,
    },
    {
      href: '/trending',
      label: 'Trending',
      labelHe: 'טרנדי',
      icon: <Flame className="w-6 h-6" />,
    },
    {
      href: '/map',
      label: 'Map',
      labelHe: 'מפה',
      icon: <Map className="w-6 h-6" />,
    },
    {
      href: '/saved',
      label: 'Saved',
      labelHe: 'שמורים',
      icon: <Heart className="w-6 h-6" />,
      badge: favorites.length > 0 ? favorites.length : undefined,
    },
    {
      href: '/more',
      label: 'More',
      labelHe: 'עוד',
      icon: <Menu className="w-6 h-6" />,
    },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <nav className="bottom-nav lg:hidden">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`bottom-nav-item ${isActive(item.href) ? 'active' : ''}`}
        >
          <span className="relative">
            {item.icon}
            {item.badge && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-[var(--color-accent)] text-white text-[10px] font-bold rounded-full px-1">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </span>
          <span>{item.labelHe}</span>
        </Link>
      ))}
    </nav>
  );
}
