import { useState, useEffect } from 'react'
import { Trash, Edit3, Plus, Lock, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContentSection } from '../components/content-section'

interface RolesMap {
  [key: string]: string[]
}

const AVAILABLE_PERMISSIONS = [
  { key: 'live_monitor', label: 'Live Monitor', desc: 'Access to the Live Monitor dashboard feeds and WebSocket stream.' },
  { key: 'tasks', label: 'Tasks', desc: 'Access to the Tasks / TODO list.' },
  { key: 'chats', label: 'Chats', desc: 'Access to the Chats / Messages list.' },
  { key: 'users', label: 'User Management', desc: 'Access to User & Employee Management, Invite, and Clock Sessions.' },
  { key: 'settings', label: 'General Settings', desc: 'Access to General Settings (profile, display, appearance).' },
  { key: 'roles', label: 'Role Configuration', desc: 'Access to Role Configuration and Permission Mapping.' }
]

export function SettingsRoles() {
  const [roles, setRoles] = useState<RolesMap>({})
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null) // null means creating
  const [roleName, setRoleName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { auth } = useAuthStore()
  const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''

  const fetchRoles = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${baseUrl}/api/roles`, {
        headers: {
          'Authorization': `Bearer ${auth.accessToken}`
        }
      })
      if (response.status === 401) {
        useAuthStore.getState().auth.reset()
        return
      }
      if (!response.ok) {
        throw new Error('Failed to fetch roles')
      }
      const data = await response.json()
      setRoles(data)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load roles list.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const handleOpenAddDialog = () => {
    setEditingRoleKey(null)
    setRoleName('')
    setSelectedPermissions([])
    setDialogOpen(true)
  }

  const handleOpenEditDialog = (key: string) => {
    setEditingRoleKey(key)
    // Make role name friendly for input label (capitalize first letter, replace underscores with spaces)
    const friendlyName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
    setRoleName(friendlyName)
    setSelectedPermissions(roles[key] || [])
    setDialogOpen(true)
  }

  const handleCheckboxChange = (permKey: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions(prev => [...prev, permKey])
    } else {
      setSelectedPermissions(prev => prev.filter(p => p !== permKey))
    }
  }

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error('Role name is required.')
      return
    }

    setIsSubmitting(true)
    try {
      const url = editingRoleKey 
        ? `${baseUrl}/api/roles/${editingRoleKey}` 
        : `${baseUrl}/api/roles`
      const method = editingRoleKey ? 'PUT' : 'POST'
      const body = editingRoleKey 
        ? { permissions: selectedPermissions } 
        : { name: roleName, permissions: selectedPermissions }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.accessToken}`
        },
        body: JSON.stringify(body)
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save role.')
      }

      toast.success(`Role successfully ${editingRoleKey ? 'updated' : 'created'}!`)
      setDialogOpen(false)
      fetchRoles()

      // If the current user's role was updated, we should alert them or update store
      if (auth.user && editingRoleKey && auth.user.role.includes(editingRoleKey)) {
        toast.info('Your active permissions were updated in real-time!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save role.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteRole = async (key: string) => {
    if (confirm(`Are you sure you want to delete the role "${key}"?`)) {
      try {
        const response = await fetch(`${baseUrl}/api/roles/${key}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${auth.accessToken}`
          }
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to delete role.')
        }

        toast.success(`Role "${key}" successfully deleted.`)
        fetchRoles()
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete role.')
      }
    }
  }

  return (
    <ContentSection
      title='Roles & Permissions'
      desc='Manage role access levels and select what employees have access to. Standard system roles are protected.'
    >
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h4 className='text-sm font-medium text-muted-foreground'>
            Available Roles ({Object.keys(roles).length})
          </h4>
          <Button size='sm' onClick={handleOpenAddDialog} className='h-8 gap-1.5'>
            <Plus size={16} />
            <span>Add Role</span>
          </Button>
        </div>

        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[150px]'>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className='w-[120px] text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className='h-24 text-center text-muted-foreground'>
                    Loading roles list...
                  </TableCell>
                </TableRow>
              ) : Object.keys(roles).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className='h-24 text-center text-muted-foreground'>
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(roles).map(([key, perms]) => {
                  const isSuperAdmin = key === 'superadmin'
                  const isStandard = key === 'superadmin' || key === 'admin' || key === 'employee'
                  const displayName = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')

                  return (
                    <TableRow key={key}>
                      <TableCell className='font-medium'>
                        <div className='flex items-center gap-2'>
                          <span>{displayName}</span>
                          {isStandard && (
                            <Badge variant='outline' className='h-5 bg-muted text-[10px]'>
                              System
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className='flex flex-wrap gap-1.5'>
                          {isSuperAdmin ? (
                            <Badge variant='secondary' className='bg-primary/10 text-primary hover:bg-primary/10 gap-1'>
                              <Check size={12} />
                              <span>Full Access</span>
                            </Badge>
                          ) : perms.length === 0 ? (
                            <span className='text-xs text-muted-foreground italic'>No access granted</span>
                          ) : (
                            perms.map(p => {
                              const match = AVAILABLE_PERMISSIONS.find(ap => ap.key === p)
                              return (
                                <Badge key={p} variant='secondary' className='text-xs font-normal'>
                                  {match ? match.label : p}
                                </Badge>
                              )
                            })
                          )}
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div className='flex justify-end gap-1.5'>
                          {isSuperAdmin ? (
                            <div className='flex items-center text-xs text-muted-foreground gap-1 px-2 py-1 select-none'>
                              <Lock size={12} />
                              <span>Locked</span>
                            </div>
                          ) : (
                            <>
                              <Button
                                variant='outline'
                                size='icon'
                                className='h-8 w-8'
                                onClick={() => handleOpenEditDialog(key)}
                                title='Edit Permissions'
                              >
                                <Edit3 size={14} />
                              </Button>
                              <Button
                                variant='outline'
                                size='icon'
                                className='h-8 w-8 text-destructive hover:bg-destructive/10'
                                onClick={() => handleDeleteRole(key)}
                                disabled={isStandard}
                                title={isStandard ? 'System roles cannot be deleted' : 'Delete Role'}
                              >
                                <Trash size={14} />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Roles Form Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className='sm:max-w-[480px]'>
            <DialogHeader>
              <DialogTitle>
                {editingRoleKey ? `Edit Permissions: ${roleName}` : 'Create Custom Role'}
              </DialogTitle>
              <DialogDescription>
                Define the name of this role and select the specific scopes it is authorized to access.
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4 py-3'>
              <div className='space-y-1.5'>
                <label className='text-sm font-medium leading-none'>Role Name</label>
                <Input
                  placeholder='e.g., Support Operator'
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  disabled={!!editingRoleKey}
                />
              </div>

              <Separator className='my-2' />

              <div className='space-y-2.5'>
                <label className='text-sm font-medium leading-none'>Select Allowed Access Scopes</label>
                <div className='space-y-3 rounded-md border p-3 max-h-[260px] overflow-y-auto'>
                  {AVAILABLE_PERMISSIONS.map(perm => {
                    const isChecked = selectedPermissions.includes(perm.key)
                    return (
                      <div key={perm.key} className='flex items-start gap-3 space-y-0'>
                        <Checkbox
                          id={`perm-${perm.key}`}
                          checked={isChecked}
                          onCheckedChange={(checked) => handleCheckboxChange(perm.key, !!checked)}
                        />
                        <div className='grid gap-1.5 leading-none'>
                          <label
                            htmlFor={`perm-${perm.key}`}
                            className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer'
                          >
                            {perm.label}
                          </label>
                          <p className='text-xs text-muted-foreground leading-normal'>
                            {perm.desc}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ContentSection>
  )
}
