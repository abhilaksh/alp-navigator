import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { SidebarNav } from '@/components/sidebar-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect('/sign-in');

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarNav userEmail={user.email} />
      <main className="flex-1 bg-paper overflow-y-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
