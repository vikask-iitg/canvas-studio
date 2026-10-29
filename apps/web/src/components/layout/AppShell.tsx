import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TemplateStrip } from '@/features/boards/components/TemplateStrip';
import { AccountDialog } from '@/features/account/components/AccountDialog';
import { UpgradeDialog, PlanLimitDialog } from '@/features/account/components/PlanDialogs';

export function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-app">
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      <TemplateStrip />
      <AccountDialog />
      <UpgradeDialog />
      <PlanLimitDialog />
    </div>
  );
}
