import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ location }) => {
    const { accessToken, user } = useAuthStore.getState().auth
    if (!accessToken || !user) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: location.href,
        },
      })
    }

    // Check permissions dynamically based on the location pathname
    const path = location.pathname
    let requiredPermission: string | null = null

    if (path === '/') requiredPermission = 'live_monitor'
    else if (path.startsWith('/tasks')) requiredPermission = 'tasks'
    else if (path.startsWith('/chats')) requiredPermission = 'chats'
    else if (path.startsWith('/users')) requiredPermission = 'users'
    else if (path.startsWith('/time-tracking')) requiredPermission = 'users'
    else if (path.startsWith('/settings/roles')) requiredPermission = 'roles'
    else if (path.startsWith('/settings')) requiredPermission = 'settings'

    if (requiredPermission) {
      const hasPermission = user.permissions?.includes(requiredPermission)
      if (!hasPermission) {
        // Find first allowed permission mapping to a path
        const allowedPaths: { [key: string]: string } = {
          live_monitor: '/',
          tasks: '/tasks',
          chats: '/chats',
          users: '/users',
          settings: '/settings',
        }

        const firstAllowed = Object.entries(allowedPaths).find(([perm]) =>
          user.permissions?.includes(perm)
        )

        if (firstAllowed) {
          throw redirect({ to: firstAllowed[1] })
        } else {
          // If no permissions are assigned, redirect to sign-in
          throw redirect({ to: '/sign-in' })
        }
      }
    }
  },
  component: AuthenticatedLayout,
})
