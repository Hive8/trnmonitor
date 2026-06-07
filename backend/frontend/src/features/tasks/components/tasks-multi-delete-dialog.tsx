'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTasks } from './tasks-provider'
import { useAuthStore } from '@/stores/auth-store'

type TaskMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE'

export function TasksMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: TaskMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const { fetchTasks } = useTasks()

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const getBaseUrl = () => window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''
  const getHeaders = () => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' }
    const { accessToken } = useAuthStore.getState().auth
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`
    }
    return headers
  }

  const handleDelete = async () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`Please type "${CONFIRM_WORD}" to confirm.`)
      return
    }

    setIsDeleting(true)
    try {
      const ids = selectedRows.map((row) => (row.original as any).id)
      const response = await fetch(`${getBaseUrl()}/api/tasks/bulk`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ ids }),
      })
      const data = await response.json()
      if (data.success) {
        await fetchTasks()
        setValue('')
        table.resetRowSelection()
        onOpenChange(false)
        toast.success(`Deleted ${selectedRows.length} ${selectedRows.length > 1 ? 'tasks' : 'task'}`)
      } else {
        toast.error(data.error || 'Failed to delete tasks')
      }
    } catch (err) {
      console.error(err)
      toast.error('An error occurred while deleting tasks')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      form='tasks-multi-delete-form'
      disabled={value.trim() !== CONFIRM_WORD || isDeleting}
      isLoading={isDeleting}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Delete {selectedRows.length}{' '}
          {selectedRows.length > 1 ? 'tasks' : 'task'}
        </span>
      }
      desc={
        <form
          id='tasks-multi-delete-form'
          onSubmit={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className='space-y-4'
        >
          <p className='mb-2'>
            Are you sure you want to delete the selected tasks? <br />
            This action cannot be undone.
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>Confirm by typing "{CONFIRM_WORD}":</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Type "${CONFIRM_WORD}" to confirm.`}
              autoFocus
              disabled={isDeleting}
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
              Please be careful, this operation can not be rolled back.
            </AlertDescription>
          </Alert>
        </form>
      }
      confirmText={
        isDeleting ? (
          <span className='flex items-center gap-1'>
            <Loader2 className='h-3 w-3 animate-spin' /> Deleting
          </span>
        ) : (
          'Delete'
        )
      }
      destructive
    />
  )
}
