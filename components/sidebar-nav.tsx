'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Map, Users, Settings, LogOut, LayoutDashboard } from 'lucide-react';
import { signOut } from '@/app/(login)/actions';

interface SidebarNavProps {
  userEmail: string;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trips', label: 'Trips', icon: Map },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ userEmail }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/sign-in');
  }

  return (
    <aside className="flex flex-col w-16 lg:w-[220px] bg-spruce h-screen flex-shrink-0 overflow-y-auto">
      {/* Monogram / wordmark */}
      <div className="px-3 lg:px-5 pt-6 pb-4">
        <Link href="/trips" className="block">
          {/* Desktop: full wordmark */}
          <span className="hidden lg:block font-display text-2xl text-white tracking-tight leading-none">
            alp
          </span>
          {/* Mobile: compact monogram */}
          <span className="lg:hidden block font-display text-xl text-white tracking-tight leading-none text-center">
            a
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 lg:px-3 pt-2 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-2.5 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-white/10 text-white border-l-2 border-brass'
                  : 'text-white/65 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon
                className={`flex-shrink-0 ${isActive ? 'text-brass' : 'text-current'}`}
                size={17}
              />
              <span className="hidden lg:block font-sans">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user + sign out */}
      <div className="px-3 lg:px-4 py-5 border-t border-white/10 mt-auto">
        {/* Desktop: email + sign out */}
        <div className="hidden lg:block">
          <p className="text-white/50 text-xs truncate mb-3">{userEmail}</p>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-white/55 hover:text-white text-xs transition-colors w-full"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
        {/* Mobile: just sign out icon */}
        <div className="lg:hidden flex justify-center">
          <button
            onClick={handleSignOut}
            className="text-white/55 hover:text-white transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
