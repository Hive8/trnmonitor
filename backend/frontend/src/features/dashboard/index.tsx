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
import { Terminal } from 'lucide-react';

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
      <Main>
        <div className='mb-4 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Live Monitor</h1>
          <div className='flex items-center space-x-2'>
            <Button variant="outline" onClick={() => setIsSimulatorOpen(true)} className="gap-2">
              <Terminal className="w-4 h-4" />
              Open Simulator
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6 flex flex-col h-full">
            {/* Primary Monitor */}
            <div className="min-h-[500px] flex-shrink-0">
              <LiveMonitorCard />
            </div>
            
            {/* Sessions Table */}
            <div className="flex-1 min-h-[400px]">
              <SyncSessionsTable />
            </div>
          </div>

          <div className="lg:col-span-1 h-full">
            <DeviceConsole />
          </div>
        </div>

        <DeviceSimulatorModal isOpen={isSimulatorOpen} onOpenChange={setIsSimulatorOpen} />
        <VideoPlayerModal />
      </Main>
    </>
  );
}
