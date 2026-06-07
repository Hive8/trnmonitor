import { ConfirmDialog } from '@/components/confirm-dialog'
import { TasksImportDialog } from './tasks-import-dialog'
import { TasksMutateDrawer } from './tasks-mutate-drawer'
import { useTasks } from './tasks-provider'
import { useAuthStore } from '@/stores/auth-store'

export function TasksDialogs() {
  const { open, setOpen, currentRow, setCurrentRow, fetchTasks } = useTasks()

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
    if (!currentRow) return
    try {
      const response = await fetch(`${getBaseUrl()}/api/tasks/${currentRow.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      const data = await response.json()
      if (data.success) {
        await fetchTasks()
      }
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  return (
    <>
      <TasksMutateDrawer
        key='task-create'
        open={open === 'create'}
        onOpenChange={() => setOpen('create')}
      />

      <TasksImportDialog
        key='tasks-import'
        open={open === 'import'}
        onOpenChange={() => setOpen('import')}
      />

      {currentRow && (
        <>
          <TasksMutateDrawer
            key={`task-update-${currentRow.id}`}
            open={open === 'update'}
            onOpenChange={() => {
              setOpen('update')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            currentRow={currentRow}
          />

          <ConfirmDialog
            key='task-delete'
            destructive
            open={open === 'delete'}
            onOpenChange={() => {
              setOpen('delete')
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            handleConfirm={async () => {
              await handleDelete()
              setOpen(null)
              setTimeout(() => {
                setCurrentRow(null)
              }, 500)
            }}
            className='max-w-md'
            title={`Delete this task: ${currentRow.id} ?`}
            desc={
              <>
                You are about to delete a task with the ID{' '}
                <strong>{currentRow.id}</strong>. <br />
                This action cannot be undone.
              </>
            }
            confirmText='Delete'
          />
        </>
      )}
    </>
  )
}
