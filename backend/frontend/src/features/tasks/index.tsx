import { useState } from 'react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutGrid, List, Loader2, BarChart2 } from 'lucide-react'
import { TasksDialogs } from './components/tasks-dialogs'
import { TasksPrimaryButtons } from './components/tasks-primary-buttons'
import { TasksProvider, useTasks } from './components/tasks-provider'
import { TasksTable } from './components/tasks-table'
import { KanbanView } from './components/kanban-view'
import { TasksOverview } from './components/tasks-overview'
import { useDeviceStream } from '@/hooks/useDeviceStream'
import { useAuthStore } from '@/stores/auth-store'

export function Tasks() {
  return (
    <TasksProvider>
      <TasksInner />
    </TasksProvider>
  )
}

function TasksInner() {
  const { tasks, isLoading, fetchTasks } = useTasks()
  const { employees } = useDeviceStream()
  const [viewMode, setViewMode] = useState<'overview' | 'kanban' | 'table'>('overview')

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''
  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const { accessToken } = useAuthStore.getState().auth
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`${getBaseUrl()}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await response.json()
      if (data.success) {
        await fetchTasks()
      }
    } catch (err) {
      console.error('Failed to update task status:', err)
    }
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Tasks</h2>
            <p className='text-muted-foreground'>
              Here&apos;s a list of your tasks for this month!
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <Tabs value={viewMode} onValueChange={(val) => setViewMode(val as any)}>
              <TabsList>
                <TabsTrigger value='overview' className='gap-1.5'>
                  <BarChart2 size={16} />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger value='kanban' className='gap-1.5'>
                  <LayoutGrid size={16} />
                  <span>Kanban</span>
                </TabsTrigger>
                <TabsTrigger value='table' className='gap-1.5'>
                  <List size={16} />
                  <span>Table</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <TasksPrimaryButtons />
          </div>
        </div>

        {isLoading && tasks.length === 0 ? (
          <div className='flex flex-1 items-center justify-center min-h-[400px]'>
            <Loader2 className='h-8 w-8 animate-spin text-primary' />
          </div>
        ) : viewMode === 'overview' ? (
          <TasksOverview tasks={tasks} employees={employees} />
        ) : viewMode === 'kanban' ? (
          <div className='flex-1 min-h-[500px] overflow-hidden'>
            <KanbanView
              tasks={tasks}
              employees={employees}
              onStatusChange={handleStatusChange}
            />
          </div>
        ) : (
          <TasksTable data={tasks} />
        )}
      </Main>

      <TasksDialogs />
    </>
  )
}
