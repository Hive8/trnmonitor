import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { TopNav } from '@/components/layout/top-nav';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';
import { LiveMonitorCard } from './components/live-monitor-card';
import { DeviceConsole } from './components/device-console';
import { SyncSessionsTable } from './components/sync-sessions-table';
import { DeviceSimulatorModal } from './components/device-simulator-modal';
import { VideoPlayerModal } from './components/video-player-modal';
import { DashboardOverview } from './components/dashboard-overview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Terminal, LayoutGrid, Monitor, History } from 'lucide-react';

const topNav = [
  {
    title: 'Live Monitor',
    href: '/',
    isActive: true,
  },
  {
    title: 'Settings',
    href: '/settings',
    isActive: false,
    disabled: true,
  },
];

export function Dashboard() {
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <TopNav links={topNav} className='me-auto' />
        <Search />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      {/* ===== Main ===== */}
      <Main className="flex flex-col gap-6">
        <div className='flex items-center justify-between space-y-2 flex-wrap gap-4'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight text-white'>Control Panel</h1>
            <p className='text-xs text-slate-500'>Monitor tracking systems, device logs, and staff GPS locations</p>
          </div>
          <div className='flex items-center space-x-2'>
            <Button variant="outline" onClick={() => setIsSimulatorOpen(true)} className="gap-2 border-slate-800 text-slate-300">
              <Terminal className="w-4 h-4" />
              Open Simulator
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full flex-1 flex flex-col gap-6">
          <TabsList className="bg-slate-900 border border-slate-800 self-start p-1 h-10">
            <TabsTrigger value="overview" className="gap-2 text-xs">
              <LayoutGrid className="w-3.5 h-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="live-monitor" className="gap-2 text-xs">
              <Monitor className="w-3.5 h-3.5" />
              Live Screen Monitor
            </TabsTrigger>
            <TabsTrigger value="sessions" className="gap-2 text-xs">
              <History className="w-3.5 h-3.5" />
              Recent Sync Sessions
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Overview Dashboard */}
          <TabsContent value="overview" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <DashboardOverview />
          </TabsContent>

          {/* Tab 2: Live Screen Monitor & Device Console */}
          <TabsContent value="live-monitor" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
              <div className="lg:col-span-3 min-h-[500px]">
                <LiveMonitorCard />
              </div>
              <div className="lg:col-span-1">
                <DeviceConsole />
              </div>
            </div>
          </TabsContent>

          {/* Tab 3: Recent Sync Sessions Table */}
          <TabsContent value="sessions" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0">
            <div className="border border-slate-800 rounded-xl bg-slate-900/10 p-1 min-h-[400px]">
              <SyncSessionsTable />
            </div>
          </TabsContent>
        </Tabs>

        <DeviceSimulatorModal isOpen={isSimulatorOpen} onOpenChange={setIsSimulatorOpen} />
        <VideoPlayerModal />
      </Main>
    </>
  );
}
