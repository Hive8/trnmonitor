import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Calendar, 
  User, 
  Trash2, 
  Edit3,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'
import { type Task } from '../data/schema'
import { statuses, priorities, labels } from '../data/data'
import { cn } from '@/lib/utils'
import { useTasks } from './tasks-provider'

interface KanbanViewProps {
  tasks: Task[]
  employees: any[]
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>
}

export function KanbanView({ tasks, employees, onStatusChange }: KanbanViewProps) {
  const { setOpen, setCurrentRow } = useTasks()
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)

  const getAssigneeName = (assigneeId: string | null | undefined) => {
    if (!assigneeId) return 'Unassigned'
    const emp = employees.find(e => e.id === assigneeId)
    return emp ? `${emp.firstName} ${emp.lastName}` : 'Unassigned'
  }

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId)
    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId
    if (taskId) {
      await onStatusChange(taskId, targetStatus)
    }
    setDraggedTaskId(null)
  }

  // Quick move helpers (for mobile/touch screens or accessibility fallback)
  const handleQuickMove = async (task: Task, direction: 'left' | 'right') => {
    const statusValues = statuses.map(s => s.value)
    const currentIndex = statusValues.indexOf(task.status as any)
    if (currentIndex === -1) return

    let nextIndex = currentIndex
    if (direction === 'left' && currentIndex > 0) {
      nextIndex = currentIndex - 1
    } else if (direction === 'right' && currentIndex < statusValues.length - 1) {
      nextIndex = currentIndex + 1
    }

    if (nextIndex !== currentIndex) {
      await onStatusChange(task.id, statusValues[nextIndex])
    }
  }

  // Priority color formatting helper
  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-destructive/10 text-destructive border-destructive/20'
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    }
  }

  // Column headers theme colors matching standard design aesthetics
  const getColumnHeaderClass = (status: string) => {
    switch (status) {
      case 'backlog':
        return 'border-t-4 border-t-slate-500'
      case 'todo':
        return 'border-t-4 border-t-blue-500'
      case 'in progress':
        return 'border-t-4 border-t-amber-500'
      case 'done':
        return 'border-t-4 border-t-emerald-500'
      case 'canceled':
        return 'border-t-4 border-t-rose-500'
      default:
        return ''
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5 h-full overflow-x-auto pb-4 items-start select-none'>
      {statuses.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.value)

        return (
          <div
            key={column.value}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.value)}
            className={cn(
              'flex flex-col rounded-lg bg-card border border-border p-3 min-h-[450px] max-h-[700px] overflow-y-auto shadow-md transition-colors',
              draggedTaskId && 'bg-muted/10 border-dashed'
            )}
          >
            {/* Column Title */}
            <div className={cn('mb-3 pb-2 flex items-center justify-between border-b border-border', getColumnHeaderClass(column.value))}>
              <div className='flex items-center gap-2'>
                {column.icon && <column.icon className='size-4 text-muted-foreground' />}
                <span className='font-semibold text-sm capitalize'>{column.label}</span>
              </div>
              <Badge variant='secondary' className='rounded-full text-xs px-2 py-0.5 shrink-0'>
                {columnTasks.length}
              </Badge>
            </div>

            {/* Tasks Cards List */}
            <div className='flex flex-col gap-3 grow'>
              {columnTasks.length === 0 ? (
                <div className='flex h-32 items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-muted-foreground italic p-4'>
                  No tasks in this column. Drag tasks here.
                </div>
              ) : (
                columnTasks.map((task) => {
                  const labelObj = labels.find((l) => l.value === task.label)
                  const priorityObj = priorities.find((p) => p.value === task.priority)

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className='group relative rounded-lg border border-border bg-background/50 hover:bg-background p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-primary/30 flex flex-col gap-2'
                    >
                      {/* Card Header */}
                      <div className='flex items-center justify-between gap-1'>
                        <span className='text-[10px] font-mono text-muted-foreground'>{task.id}</span>
                        <div className='flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-6 rounded-md hover:bg-muted'
                            onClick={() => {
                              setCurrentRow(task)
                              setOpen('update')
                            }}
                            title='Edit Task'
                          >
                            <Edit3 size={12} className='text-muted-foreground hover:text-foreground' />
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-6 rounded-md hover:bg-destructive/10'
                            onClick={() => {
                              setCurrentRow(task)
                              setOpen('delete')
                            }}
                            title='Delete Task'
                          >
                            <Trash2 size={12} className='text-destructive' />
                          </Button>
                        </div>
                      </div>

                      {/* Card Title */}
                      <span className='text-xs font-semibold text-foreground line-clamp-2 leading-relaxed'>
                        {task.title}
                      </span>

                      {/* Card Description */}
                      {task.description && (
                        <p className='text-[11px] text-muted-foreground line-clamp-2 leading-normal'>
                          {task.description}
                        </p>
                      )}

                      {/* Card Metadata (Assignee & Date) */}
                      <div className='mt-1 flex flex-col gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground'>
                        <div className='flex items-center gap-1.5'>
                          <User size={10} className='shrink-0' />
                          <span className={cn('truncate', !task.assigneeId && 'italic text-muted-foreground/60')}>
                            {getAssigneeName(task.assigneeId)}
                          </span>
                        </div>
                        {task.dueDate && (
                          <div className='flex items-center gap-1.5'>
                            <Calendar size={10} className='shrink-0' />
                            <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Badges (Label & Priority) */}
                      <div className='mt-1 flex items-center justify-between gap-2 border-t border-border/20 pt-2'>
                        <div className='flex flex-wrap gap-1'>
                          {labelObj && (
                            <Badge variant='outline' className='text-[9px] px-1.5 py-0 capitalize'>
                              {labelObj.label}
                            </Badge>
                          )}
                          {priorityObj && (
                            <Badge 
                              variant='outline' 
                              className={cn('text-[9px] px-1.5 py-0 capitalize border font-normal', getPriorityBadgeClass(task.priority))}
                            >
                              {priorityObj.label}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Quick Shift buttons */}
                        <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-5 rounded-md hover:bg-muted'
                            onClick={() => handleQuickMove(task, 'left')}
                            disabled={statuses.map(s => s.value).indexOf(task.status as any) === 0}
                            title='Move Left'
                          >
                            <ArrowLeft size={10} />
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            className='size-5 rounded-md hover:bg-muted'
                            onClick={() => handleQuickMove(task, 'right')}
                            disabled={statuses.map(s => s.value).indexOf(task.status as any) === statuses.length - 1}
                            title='Move Right'
                          >
                            <ArrowRight size={10} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
