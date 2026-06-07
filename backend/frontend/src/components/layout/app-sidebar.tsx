import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
// import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { TeamSwitcher } from './team-switcher'
import { useAuthStore } from '@/stores/auth-store'
import { useDeviceStream } from '@/hooks/useDeviceStream'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { auth } = useAuthStore()
  const { unreadChatCount } = useDeviceStream()

  const userRoles = auth.user?.role || []
  const userPermissions = auth.user?.permissions || []

  const displayUser = auth.user
    ? {
        name: auth.user.email.split('@')[0].replace(/^\w/, (c) => c.toUpperCase()),
        email: auth.user.email,
        avatar: '/avatars/shadcn.jpg',
      }
    : sidebarData.user

  const filterItems = (items: any[]): any[] => {
    return items
      .filter((item) => {
        if (item.permission && !userPermissions.includes(item.permission)) {
          return false
        }
        if (item.roles && !item.roles.some((r: string) => userRoles.includes(r))) {
          return false
        }
        return true
      })
      .map((item) => {
        if (item.items) {
          return {
            ...item,
            items: filterItems(item.items),
          }
        }
        return item
      })
      .filter((item) => !item.items || item.items.length > 0)
  }

  const filteredNavGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: filterItems(group.items).map((item) => {
        if (item.title === 'Chats') {
          return {
            ...item,
            badge: unreadChatCount > 0 ? String(unreadChatCount) : undefined,
          }
        }
        return item
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <TeamSwitcher teams={sidebarData.teams} />

        {/* Replace <TeamSwitch /> with the following <AppTitle />
         /* if you want to use the normal app title instead of TeamSwitch dropdown */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={displayUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
