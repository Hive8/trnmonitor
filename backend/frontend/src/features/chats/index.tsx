import { useState, useEffect, useRef } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { format } from 'date-fns'
import {
  ArrowLeft,
  MoreVertical,
  Edit,
  Phone,
  Plus,
  Search as SearchIcon,
  Send,
  Video,
  MessagesSquare,
} from 'lucide-react'
import { cn, getDisplayNameInitials } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { NewChat } from './components/new-chat'
import { useDeviceStream } from '@/hooks/useDeviceStream'
import { useAuthStore } from '@/stores/auth-store'
import { Badge } from '@/components/ui/badge'

export function Chats() {
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [mobileSelectedUser, setMobileSelectedUser] = useState<any | null>(null)
  const [createConversationDialogOpened, setCreateConversationDialog] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [messageInput, setMessageInput] = useState('')
  
  const scrollRef = useRef<HTMLDivElement>(null)

  const { employees, unreadBySender, markChatAsRead } = useDeviceStream()
  const currentUser = useAuthStore(s => s.auth.user)

  // Filtered data based on the search query (exclude current user)
  const chatUsers = employees.filter(e => e.id !== currentUser?.accountNo)
  const filteredChatList = chatUsers.filter((user) =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(search.trim().toLowerCase())
  )

  useEffect(() => {
    if (!selectedUser) return;
    markChatAsRead(selectedUser.id);
    const fetchMessages = async () => {
      try {
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : ''
        const { accessToken } = useAuthStore.getState().auth
        const res = await fetch(`${baseUrl}/api/messages/${selectedUser.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
          setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }, 100)
        }
      } catch (err) {
        console.error('Error fetching messages', err)
      }
    }
    fetchMessages()
  }, [selectedUser])

  useEffect(() => {
    const handleNewMessage = (e: any) => {
      const msg = e.detail;
      if (selectedUser && (msg.senderId === selectedUser.id || msg.receiverId === selectedUser.id)) {
        setMessages(prev => [...prev, msg]);
        markChatAsRead(selectedUser.id);
        const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
        const { accessToken } = useAuthStore.getState().auth;
        fetch(`${baseUrl}/api/messages/${selectedUser.id}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }).catch(err => console.error(err));
        
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100)
      }
    };
    document.addEventListener('new_chat_message', handleNewMessage);
    return () => document.removeEventListener('new_chat_message', handleNewMessage);
  }, [selectedUser]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser) return;
    
    const text = messageInput;
    setMessageInput('');
    
    try {
      const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
      const { accessToken } = useAuthStore.getState().auth;
      const res = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ receiverId: selectedUser.id, message: text })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 100);
      }
    } catch (err) {
      console.error('Error sending message', err);
    }
  };

  const currentMessage = messages.reduce(
    (acc: Record<string, any[]>, obj) => {
      const key = format(new Date(obj.timestamp), 'd MMM, yyyy')
      if (!acc[key]) { acc[key] = [] }
      acc[key].push(obj)
      return acc
    },
    {}
  )

  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ConfigDrawer />
        <ProfileDropdown />
      </Header>

      <Main fixed>
        <section className='flex h-full gap-6'>
          {/* Left Side */}
          <div className='flex w-full flex-col gap-2 sm:w-56 lg:w-72 2xl:w-80'>
            <div className='sticky top-0 z-10 -mx-4 bg-background px-4 pb-3 shadow-md sm:static sm:z-auto sm:mx-0 sm:p-0 sm:shadow-none'>
              <div className='flex items-center justify-between py-2'>
                <div className='flex gap-2'>
                  <h1 className='text-2xl font-bold'>Inbox</h1>
                  <MessagesSquare size={20} />
                </div>

                <Button
                  size='icon'
                  variant='ghost'
                  onClick={() => setCreateConversationDialog(true)}
                  className='rounded-lg'
                >
                  <Edit size={24} className='stroke-muted-foreground' />
                </Button>
              </div>

              <label
                className={cn(
                  'focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden',
                  'flex h-10 w-full items-center space-x-0 rounded-md border border-border ps-2'
                )}
              >
                <SearchIcon size={15} className='me-2 stroke-slate-500' />
                <span className='sr-only'>Search</span>
                <input
                  type='text'
                  className='w-full flex-1 bg-inherit text-sm focus-visible:outline-hidden'
                  placeholder='Search chat...'
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>

            <ScrollArea className='-mx-3 h-full overflow-scroll p-3'>
              {filteredChatList.map((chatUsr) => {
                const fullName = `${chatUsr.firstName} ${chatUsr.lastName}`
                return (
                  <Fragment key={chatUsr.id}>
                    <button
                      type='button'
                      className={cn(
                        'group hover:bg-accent hover:text-accent-foreground',
                        `flex w-full rounded-md px-2 py-2 text-start text-sm`,
                        selectedUser?.id === chatUsr.id && 'sm:bg-muted'
                      )}
                      onClick={() => {
                        setSelectedUser(chatUsr)
                        setMobileSelectedUser(chatUsr)
                      }}
                    >
                      <div className='flex w-full items-center justify-between gap-2'>
                        <div className='flex gap-2'>
                          <Avatar>
                            <AvatarFallback>
                              {getDisplayNameInitials(fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className='col-start-2 row-span-2 font-medium block'>
                              {fullName}
                            </span>
                            <span className='col-start-2 row-span-2 row-start-2 line-clamp-2 text-ellipsis text-muted-foreground group-hover:text-accent-foreground/90 capitalize text-xs'>
                              {chatUsr.role}
                            </span>
                          </div>
                        </div>
                        {unreadBySender[chatUsr.id] > 0 && (
                          <Badge variant='destructive' className='rounded-full px-2 h-5 min-w-5 flex items-center justify-center text-[10px] font-bold animate-pulse'>
                            {unreadBySender[chatUsr.id]}
                          </Badge>
                        )}
                      </div>
                    </button>
                    <Separator className='my-1' />
                  </Fragment>
                )
              })}
            </ScrollArea>
          </div>

          {/* Right Side */}
          {selectedUser ? (
            <div
              className={cn(
                'absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col border bg-background shadow-xs sm:static sm:z-auto sm:flex sm:rounded-md',
                mobileSelectedUser && 'inset-s-0 flex'
              )}
            >
              {/* Top Part */}
              <div className='mb-1 flex flex-none justify-between bg-card p-4 shadow-lg sm:rounded-t-md'>
                {/* Left */}
                <div className='flex gap-3'>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='-ms-2 h-full sm:hidden'
                    onClick={() => setMobileSelectedUser(null)}
                  >
                    <ArrowLeft className='rtl:rotate-180' />
                  </Button>
                  <div className='flex items-center gap-2 lg:gap-4'>
                    <Avatar className='size-9 lg:size-11'>
                      <AvatarFallback>
                        {getDisplayNameInitials(`${selectedUser.firstName} ${selectedUser.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <span className='col-start-2 row-span-2 text-sm font-medium lg:text-base'>
                        {`${selectedUser.firstName} ${selectedUser.lastName}`}
                      </span>
                      <span className='col-start-2 row-span-2 row-start-2 line-clamp-1 block max-w-32 text-xs text-nowrap text-ellipsis text-muted-foreground lg:max-w-none lg:text-sm capitalize'>
                        {selectedUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right */}
                <div className='-me-1 flex items-center gap-1 lg:gap-2'>
                  <Button size='icon' variant='ghost' className='hidden size-8 rounded-full sm:inline-flex lg:size-10'>
                    <Video size={22} className='stroke-muted-foreground' />
                  </Button>
                  <Button size='icon' variant='ghost' className='hidden size-8 rounded-full sm:inline-flex lg:size-10'>
                    <Phone size={22} className='stroke-muted-foreground' />
                  </Button>
                  <Button size='icon' variant='ghost' className='h-10 rounded-md sm:h-8 sm:w-4 lg:h-10 lg:w-6'>
                    <MoreVertical className='stroke-muted-foreground sm:size-5' />
                  </Button>
                </div>
              </div>

              {/* Conversation */}
              <div className='flex flex-1 flex-col gap-2 rounded-md px-4 pt-0 pb-4'>
                <div className='flex size-full flex-1'>
                  <div className='chat-text-container relative -me-4 flex flex-1 flex-col overflow-y-hidden'>
                    <div ref={scrollRef} className='chat-flex flex h-40 w-full grow flex-col justify-start gap-4 overflow-y-auto py-2 pe-4 pb-4'>
                      {currentMessage &&
                        Object.keys(currentMessage).map((key) => (
                          <Fragment key={key}>
                            <div className='text-center text-xs'>{key}</div>
                            {currentMessage[key].map((msg, index) => {
                              const isMe = msg.senderId === currentUser?.accountNo;
                              return (
                                <div
                                  key={msg.id || index}
                                  className={cn(
                                    'chat-box max-w-72 px-3 py-2 wrap-break-word shadow-lg',
                                    isMe
                                      ? 'self-end rounded-[16px_16px_0_16px] bg-primary/90 text-primary-foreground/75'
                                      : 'self-start rounded-[16px_16px_16px_0] bg-muted'
                                  )}
                                >
                                  {msg.message}{' '}
                                  <span
                                    className={cn(
                                      'mt-1 block text-xs font-light text-foreground/75 italic',
                                      isMe && 'text-end text-primary-foreground/85'
                                    )}
                                  >
                                    {format(new Date(msg.timestamp), 'h:mm a')}
                                  </span>
                                </div>
                              )
                            })}
                          </Fragment>
                        ))}
                    </div>
                  </div>
                </div>
                <form className='flex w-full flex-none gap-2' onSubmit={sendMessage}>
                  <div className='flex flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden lg:gap-4'>
                    <div className='space-x-1'>
                      <Button size='icon' type='button' variant='ghost' className='h-8 rounded-md'>
                        <Plus size={20} className='stroke-muted-foreground' />
                      </Button>
                    </div>
                    <label className='flex-1'>
                      <span className='sr-only'>Chat Text Box</span>
                      <input
                        type='text'
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        placeholder='Type your messages...'
                        className='h-8 w-full bg-inherit focus-visible:outline-hidden'
                      />
                    </label>
                    <Button variant='ghost' size='icon' className='hidden sm:inline-flex' type='submit'>
                      <Send size={20} />
                    </Button>
                  </div>
                  <Button className='h-full sm:hidden' type='submit'>
                    <Send size={18} /> Send
                  </Button>
                </form>
              </div>
            </div>
          ) : (
            <div className={cn('absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col justify-center rounded-md border bg-card shadow-xs sm:static sm:z-auto sm:flex')}>
              <div className='flex flex-col items-center space-y-6'>
                <div className='flex size-16 items-center justify-center rounded-full border-2 border-border'>
                  <MessagesSquare className='size-8' />
                </div>
                <div className='space-y-2 text-center'>
                  <h1 className='text-xl font-semibold'>Your messages</h1>
                  <p className='text-sm text-muted-foreground'>
                    Select a user to start a chat.
                  </p>
                </div>
                <Button onClick={() => setCreateConversationDialog(true)}>
                  Send message
                </Button>
              </div>
            </div>
          )}
        </section>
        <NewChat
          users={chatUsers}
          onOpenChange={setCreateConversationDialog}
          open={createConversationDialogOpened}
        />
      </Main>
    </>
  )
}
