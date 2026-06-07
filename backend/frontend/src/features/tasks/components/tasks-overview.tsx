import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { type Task } from '../data/schema'
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ListTodo, 
  Users, 
  Calendar, 
  ArrowUp,
  ArrowRight,
  ArrowDown,
  User,
  ArrowRightCircle
} from 'lucide-react'
import { useTasks } from './tasks-provider'

interface TasksOverviewProps {
  tasks: Task[]
  employees: any[]
}

export function TasksOverview({ tasks, employees }: TasksOverviewProps) {
  const { setOpen, setCurrentRow } = useTasks()
  const now = new Date()

  // 1. KPI Counts
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'done').length
  const inProgressTasks = tasks.filter(t => t.status === 'in progress').length
  
  // Pending means active backlog/todo/in-progress
  const pendingTasks = tasks.filter(t => t.status !== 'done' && t.status !== 'canceled').length
  const unassignedTasks = tasks.filter(t => !t.assigneeId).length
  
  // Overdue calculation (Active tasks past their due date)
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'done' || t.status === 'canceled') return false
    if (!t.dueDate) return false
    return new Date(t.dueDate) < now
  })
  const overdueCount = overdueTasks.length

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  // 2. Status Distribution counts
  const statusCounts = {
    backlog: tasks.filter(t => t.status === 'backlog').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    'in progress': tasks.filter(t => t.status === 'in progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    canceled: tasks.filter(t => t.status === 'canceled').length,
  }

  // 3. Priority counts
  const priorityCounts = {
    low: tasks.filter(t => t.priority === 'low').length,
    medium: tasks.filter(t => t.priority === 'medium').length,
    high: tasks.filter(t => t.priority === 'high').length,
    critical: tasks.filter(t => t.priority === 'critical').length,
  }

  // 4. Critical & Overdue Tasks (Sort by due date, show top 5)
  const criticalFocusTasks = tasks
    .filter(t => {
      if (t.status === 'done' || t.status === 'canceled') return false
      return t.priority === 'high' || t.priority === 'critical' || (t.dueDate && new Date(t.dueDate) < now)
    })
    .sort((a, b) => {
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
    .slice(0, 5)

  // 5. Employee Workload list
  const employeeWorkloads = employees.map(emp => {
    const empTasks = tasks.filter(t => t.assigneeId === emp.id)
    const empPending = empTasks.filter(t => t.status !== 'done' && t.status !== 'canceled').length
    const empCompleted = empTasks.filter(t => t.status === 'done').length
    const empRate = empTasks.length > 0 ? Math.round((empCompleted / empTasks.length) * 100) : 0

    return {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      total: empTasks.length,
      pending: empPending,
      completed: empCompleted,
      completionRate: empRate,
    }
  }).sort((a, b) => b.pending - a.pending)

  const getAssigneeName = (assigneeId: string | null | undefined) => {
    if (!assigneeId) return 'Unassigned'
    const emp = employees.find(e => e.id === assigneeId)
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'
  }

  return (
    <div className='space-y-6'>
      {/* ===== KPI Metrics Grid ===== */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {/* Total Tasks Card */}
        <Card className='border-slate-800 bg-slate-900/40 shadow-sm'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-semibold text-slate-400'>Total Tasks</CardTitle>
            <ListTodo className='h-4.5 w-4.5 text-blue-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-white'>{totalTasks}</div>
            <p className='text-xs text-slate-500 mt-1 flex items-center gap-1.5'>
              <span>{pendingTasks} active pending</span>
              <span className='h-1.5 w-1.5 rounded-full bg-blue-500' />
              <span>{unassignedTasks} unassigned</span>
            </p>
          </CardContent>
        </Card>

        {/* In Progress Card */}
        <Card className='border-slate-800 bg-slate-900/40 shadow-sm'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-semibold text-slate-400'>In Progress</CardTitle>
            <Clock className='h-4.5 w-4.5 text-amber-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-white'>{inProgressTasks}</div>
            <div className='w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden'>
              <div 
                className='bg-amber-500 h-full rounded-full transition-all'
                style={{ width: `${totalTasks > 0 ? (inProgressTasks / totalTasks) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Completion Rate Card */}
        <Card className='border-slate-800 bg-slate-900/40 shadow-sm'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-semibold text-slate-400'>Completion Rate</CardTitle>
            <CheckCircle2 className='h-4.5 w-4.5 text-emerald-500' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-white'>{completionRate}%</div>
            <div className='w-full bg-slate-800/80 rounded-full h-1.5 mt-2 overflow-hidden'>
              <div 
                className='bg-emerald-500 h-full rounded-full transition-all'
                style={{ width: `${completionRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Critical & Overdue Tasks Card */}
        <Card className='border-slate-800 bg-slate-900/40 shadow-sm'>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardTitle className='text-sm font-semibold text-slate-400'>Overdue Tasks</CardTitle>
            <AlertCircle className={`h-4.5 w-4.5 ${overdueCount > 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`} />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold text-white'>{overdueCount}</div>
            <p className='text-xs text-slate-500 mt-1'>
              {overdueCount > 0 ? `${overdueCount} active tasks require immediate action` : 'All due dates are on schedule'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== Center Layout: Distribution & Critical Tasks ===== */}
      <div className='grid gap-6 grid-cols-1 lg:grid-cols-3'>
        {/* Status Distribution (1/3 width) */}
        <Card className='border-slate-800 bg-slate-900/40 flex flex-col'>
          <CardHeader>
            <CardTitle className='text-md font-bold text-white'>Status Breakdown</CardTitle>
            <CardDescription className='text-xs text-slate-500'>Task allocation across workflows</CardDescription>
          </CardHeader>
          <CardContent className='flex-1 flex flex-col justify-center gap-4'>
            {/* Backlog */}
            <div className='space-y-1.5'>
              <div className='flex justify-between text-xs font-medium text-slate-300'>
                <span className='capitalize'>Backlog</span>
                <span>{statusCounts.backlog}</span>
              </div>
              <div className='w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/50'>
                <div className='bg-slate-500 h-full rounded-full transition-all' style={{ width: `${totalTasks > 0 ? (statusCounts.backlog / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Todo */}
            <div className='space-y-1.5'>
              <div className='flex justify-between text-xs font-medium text-slate-300'>
                <span className='capitalize'>Todo</span>
                <span>{statusCounts.todo}</span>
              </div>
              <div className='w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/50'>
                <div className='bg-blue-500 h-full rounded-full transition-all' style={{ width: `${totalTasks > 0 ? (statusCounts.todo / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>

            {/* In Progress */}
            <div className='space-y-1.5'>
              <div className='flex justify-between text-xs font-medium text-slate-300'>
                <span className='capitalize'>In Progress</span>
                <span>{statusCounts['in progress']}</span>
              </div>
              <div className='w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/50'>
                <div className='bg-amber-500 h-full rounded-full transition-all' style={{ width: `${totalTasks > 0 ? (statusCounts['in progress'] / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Done */}
            <div className='space-y-1.5'>
              <div className='flex justify-between text-xs font-medium text-slate-300'>
                <span className='capitalize'>Done</span>
                <span>{statusCounts.done}</span>
              </div>
              <div className='w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/50'>
                <div className='bg-emerald-500 h-full rounded-full transition-all' style={{ width: `${totalTasks > 0 ? (statusCounts.done / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>

            {/* Canceled */}
            <div className='space-y-1.5'>
              <div className='flex justify-between text-xs font-medium text-slate-300'>
                <span className='capitalize'>Canceled</span>
                <span>{statusCounts.canceled}</span>
              </div>
              <div className='w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800/50'>
                <div className='bg-rose-500 h-full rounded-full transition-all' style={{ width: `${totalTasks > 0 ? (statusCounts.canceled / totalTasks) * 100 : 0}%` }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Priority Breakdown & Critical List (2/3 width) */}
        <div className='lg:col-span-2 flex flex-col gap-6'>
          {/* Priority breakdown cards */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            {/* Low */}
            <Card className='border-slate-800 bg-slate-900/40 p-3 flex flex-col justify-between shadow-sm'>
              <div className='flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                <span>LOW</span>
                <ArrowDown className='size-3 text-blue-500' />
              </div>
              <div className='text-xl font-bold text-white mt-2'>{priorityCounts.low}</div>
            </Card>

            {/* Medium */}
            <Card className='border-slate-800 bg-slate-900/40 p-3 flex flex-col justify-between shadow-sm'>
              <div className='flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                <span>MEDIUM</span>
                <ArrowRight className='size-3 text-amber-500' />
              </div>
              <div className='text-xl font-bold text-white mt-2'>{priorityCounts.medium}</div>
            </Card>

            {/* High */}
            <Card className='border-slate-800 bg-slate-900/40 p-3 flex flex-col justify-between shadow-sm'>
              <div className='flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                <span>HIGH</span>
                <ArrowUp className='size-3 text-rose-500' />
              </div>
              <div className='text-xl font-bold text-white mt-2'>{priorityCounts.high}</div>
            </Card>

            {/* Critical */}
            <Card className='border-slate-800 bg-slate-900/40 p-3 flex flex-col justify-between shadow-sm'>
              <div className='flex items-center justify-between text-[11px] font-semibold text-slate-500'>
                <span>CRITICAL</span>
                <AlertCircle className='size-3 text-red-500' />
              </div>
              <div className='text-xl font-bold text-white mt-2'>{priorityCounts.critical}</div>
            </Card>
          </div>

          {/* Critical Focus Tasks List */}
          <Card className='border-slate-800 bg-slate-900/40 flex-1 flex flex-col overflow-hidden min-h-[300px]'>
            <CardHeader className='pb-3'>
              <CardTitle className='text-md font-bold text-white'>Critical Focus Required</CardTitle>
              <CardDescription className='text-xs text-slate-500'>High-priority and overdue active tasks</CardDescription>
            </CardHeader>
            <CardContent className='flex-1 overflow-y-auto p-0 border-t border-slate-800'>
              {criticalFocusTasks.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-12 text-slate-500 italic text-xs'>
                  No outstanding high-priority or overdue tasks.
                </div>
              ) : (
                <div className='divide-y divide-slate-800'>
                  {criticalFocusTasks.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < now
                    return (
                      <div 
                        key={task.id} 
                        className='flex items-center justify-between p-4 hover:bg-slate-900/60 transition-colors'
                      >
                        <div className='flex flex-col gap-1 max-w-[65%]'>
                          <div className='flex items-center gap-2'>
                            <span className='text-[10px] font-mono text-slate-500'>{task.id}</span>
                            <Badge 
                              variant='outline' 
                              className={`text-[9px] px-1 px-1.5 py-0 capitalize ${
                                task.priority === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}
                            >
                              {task.priority}
                            </Badge>
                            {isOverdue && (
                              <Badge variant='outline' className='text-[9px] px-1.5 py-0 bg-red-500 text-white border-red-600 animate-pulse'>
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <span className='text-xs font-semibold text-slate-200 line-clamp-1'>{task.title}</span>
                          <span className='text-[10px] text-slate-500 flex items-center gap-1.5'>
                            <User size={10} />
                            <span>{getAssigneeName(task.assigneeId)}</span>
                          </span>
                        </div>

                        <div className='flex items-center gap-4'>
                          {task.dueDate && (
                            <div className='text-right text-[10px] text-slate-400 flex items-center gap-1.5'>
                              <Calendar size={10} className='text-slate-500' />
                              <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-7 rounded-md hover:bg-slate-850 hover:text-white text-slate-400'
                            onClick={() => {
                              setCurrentRow(task)
                              setOpen('update')
                            }}
                          >
                            <ArrowRightCircle size={14} />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== Bottom Layout: Employee Workload ===== */}
      <Card className='border-slate-800 bg-slate-900/40'>
        <CardHeader className='pb-3 flex flex-row items-center justify-between'>
          <div>
            <CardTitle className='text-md font-bold text-white'>Staff Task Workload</CardTitle>
            <CardDescription className='text-xs text-slate-500'>Current task distribution per employee</CardDescription>
          </div>
          <Badge variant='secondary' className='rounded-full text-xs px-2 py-0.5'>
            <Users size={12} className='inline mr-1 text-slate-400' />
            {employeeWorkloads.length} Staff members
          </Badge>
        </CardHeader>
        <CardContent className='pt-2'>
          {employeeWorkloads.length === 0 ? (
            <div className='text-center py-8 text-slate-500 italic text-xs'>
              No staff members registered to compare workloads.
            </div>
          ) : (
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {employeeWorkloads.map(emp => (
                <div 
                  key={emp.id}
                  className='p-4 rounded-lg border border-slate-800/80 bg-slate-950/40 hover:bg-slate-950/80 transition-colors flex flex-col justify-between gap-3 shadow-sm'
                >
                  <div className='flex items-start justify-between gap-2'>
                    <div>
                      <h4 className='text-xs font-bold text-slate-200'>{emp.name}</h4>
                      <span className='text-[10px] font-mono text-slate-500'>{emp.id}</span>
                    </div>
                    <Badge variant='outline' className={`text-[10px] font-semibold border ${
                      emp.pending > 0 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                    }`}>
                      {emp.pending} Pending
                    </Badge>
                  </div>

                  <div className='space-y-1'>
                    <div className='flex justify-between text-[10px] text-slate-400'>
                      <span>Progress</span>
                      <span>{emp.completionRate}% ({emp.completed}/{emp.total})</span>
                    </div>
                    <div className='w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800/50'>
                      <div 
                        className={`h-full rounded-full transition-all ${
                          emp.completionRate >= 80 ? 'bg-emerald-500' : emp.completionRate >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${emp.completionRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
