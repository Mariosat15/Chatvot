'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Trophy,
  Swords,
  Wallet,
  User,
} from 'lucide-react';

const navItems = [
  {
    href: '/',
    label: 'Home',
    icon: LayoutDashboard,
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/20',
  },
  {
    href: '/competitions',
    label: 'Compete',
    icon: Trophy,
    color: 'text-yellow-400',
    activeColor: 'bg-yellow-500/20',
  },
  {
    href: '/challenges',
    label: 'Battle',
    icon: Swords,
    color: 'text-red-400',
    activeColor: 'bg-red-500/20',
  },
  {
    href: '/wallet',
    label: 'Wallet',
    icon: Wallet,
    color: 'text-green-400',
    activeColor: 'bg-green-500/20',
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: User,
    color: 'text-cyan-400',
    activeColor: 'bg-cyan-500/20',
  },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/' || pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-t border-gray-800/50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full py-2 px-1 rounded-xl transition-all duration-200',
                active && item.activeColor
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200',
                  active ? item.color : 'text-gray-500'
                )}
              >
                <Icon className={cn('h-5 w-5', active && 'scale-110')} />
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium mt-0.5 transition-colors',
                  active ? item.color : 'text-gray-500'
                )}
              >
                {item.label}
              </span>
              {active && (
                <div className={cn('w-1 h-1 rounded-full mt-0.5', item.color.replace('text-', 'bg-'))} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

