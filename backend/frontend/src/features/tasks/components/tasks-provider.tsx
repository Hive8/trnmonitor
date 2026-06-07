import React, { useState, useEffect } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import { type Task } from '../data/schema'
import { useAuthStore } from '@/stores/auth-store'

type TasksDialogType = 'create' | 'update' | 'delete' | 'import'

type TasksContextType = {
  open: TasksDialogType | null
  setOpen: (str: TasksDialogType | null) => void
  currentRow: Task | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Task | null>>
  tasks: Task[]
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>
  isLoading: boolean
  fetchTasks: () => Promise<void>
}

const TasksContext = React.createContext<TasksContextType | null>(null)

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<TasksDialogType>(null)
  const [currentRow, setCurrentRow] = useState<Task | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''
  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const { accessToken } = useAuthStore.getState().auth
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  const fetchTasks = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${getBaseUrl()}/api/tasks`, {
        headers: getHeaders()
      })
      const data = await response.json()
      if (data.success && Array.isArray(data.tasks)) {
        setTasks(data.tasks)
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [])

  useEffect(() => {
    const handleTasksUpdate = (e: Event) => {
      const customEvent = e as CustomEvent
      if (Array.isArray(customEvent.detail)) {
        setTasks(customEvent.detail)
      }
    }
    document.addEventListener('tasks_update', handleTasksUpdate)
    return () => document.removeEventListener('tasks_update', handleTasksUpdate)
  }, [])

  return (
    <TasksContext value={{ open, setOpen, currentRow, setCurrentRow, tasks, setTasks, isLoading, fetchTasks }}>
      {children}
    </TasksContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTasks = () => {
  const tasksContext = React.useContext(TasksContext)

  if (!tasksContext) {
    throw new Error('useTasks has to be used within <TasksContext>')
  }

  return tasksContext
}
