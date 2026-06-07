import { useState, useEffect, useRef } from 'react'
import { Fragment } from 'react/jsx-runtime'
import { format } from 'date-fns'
import {
  ArrowLeft,
  MoreVertical,
  Edit,
  Phone,
  Search as SearchIcon,
  Send,
  Video,
  MessagesSquare,
  Paperclip,
  CornerUpLeft,
  X,
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
  const [replyingTo, setReplyingTo] = useState<any | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [uploadedFileData, setUploadedFileData] = useState<any | null>(null)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { employees, unreadBySender, markChatAsRead } = useDeviceStream()
  const currentUser = useAuthStore(s => s.auth.user)

  // Filtered data based on the search query (exclude current user)
  const chatUsers = employees.filter(e => e.id !== currentUser?.accountNo)
  const filteredChatList = chatUsers.filter((user) =>
    `${user.firstName} ${user.lastName}`.toLowerCase().includes(search.trim().toLowerCase())
  )

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress('Uploading...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
      const { accessToken } = useAuthStore.getState().auth;
      
      const res = await fetch(`${baseUrl}/api/attachments/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setUploadedFileData({
            fileUrl: data.fileUrl,
            fileName: data.fileName,
            fileType: data.fileType
          });
          setUploadProgress('Uploaded!');
        } else {
          setUploadProgress('Failed to upload');
        }
      } else {
        setUploadProgress('Upload failed');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setUploadProgress('Error uploading');
    } finally {
      setIsUploading(false);
    }
  };

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
    if (!messageInput.trim() && !uploadedFileData) return;
    
    const text = messageInput;
    setMessageInput('');
    
    let messageContent = text;
    if (uploadedFileData || replyingTo) {
      const payload: any = {
        is_json: true,
        text: text,
      };
      if (uploadedFileData) {
        payload.file_url = uploadedFileData.fileUrl;
        payload.file_name = uploadedFileData.fileName;
        payload.file_type = uploadedFileData.fileType;
      }
      if (replyingTo) {
        let replyText = replyingTo.message;
        try {
          if (replyingTo.message.startsWith('{')) {
            const parsed = JSON.parse(replyingTo.message);
            if (parsed.is_json) replyText = parsed.text || '[Attachment]';
          }
        } catch (_) {}

        payload.reply_to = {
          id: replyingTo.id,
          sender_id: replyingTo.senderId,
          message: replyText,
          timestamp: replyingTo.timestamp
        };
      }
      messageContent = JSON.stringify(payload);
    }

    setUploadedFileData(null);
    setSelectedFile(null);
    setReplyingTo(null);
    setUploadProgress(null);
    
    try {
      const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
      const { accessToken } = useAuthStore.getState().auth;
      const res = await fetch(`${baseUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ receiverId: selectedUser.id, message: messageContent })
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
                              
                              let parsedMsg: {
                                text: string;
                                file_url: string | null;
                                file_name: string | null;
                                file_type: string | null;
                                reply_to: {
                                  sender_id: string;
                                  message: string;
                                } | null;
                              } = {
                                text: msg.message,
                                file_url: null,
                                file_name: null,
                                file_type: null,
                                reply_to: null
                              };
                              
                              try {
                                if (msg.message.startsWith('{')) {
                                  const parsed = JSON.parse(msg.message);
                                  if (parsed.is_json) {
                                    parsedMsg = parsed;
                                  }
                                }
                              } catch (_) {}

                              const getFullFileUrl = (url: string | null) => {
                                if (!url) return '';
                                if (url.startsWith('http')) return url;
                                const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
                                return `${baseUrl}${url}`;
                              };

                              return (
                                <div key={msg.id || index} className={cn('flex items-center gap-2 group/message', isMe ? 'self-end' : 'self-start')}>
                                  {!isMe && (
                                    <Button
                                      size='icon'
                                      variant='ghost'
                                      className='opacity-0 group-hover/message:opacity-100 h-6 w-6 rounded-full shrink-0 transition-opacity'
                                      onClick={() => setReplyingTo(msg)}
                                      title='Reply to message'
                                    >
                                      <CornerUpLeft size={14} className='text-muted-foreground hover:text-primary' />
                                    </Button>
                                  )}
                                  <div
                                    className={cn(
                                      'chat-box max-w-72 px-3 py-2 wrap-break-word shadow-lg flex flex-col',
                                      isMe
                                        ? 'rounded-[16px_16px_0_16px] bg-primary/90 text-primary-foreground/75'
                                        : 'rounded-[16px_16px_16px_0] bg-muted'
                                    )}
                                  >
                                    {parsedMsg.reply_to && (
                                      <div className='mb-2 rounded-md bg-black/10 p-2 text-xs border-l-2 border-primary/50 text-foreground/80 dark:text-foreground/90 max-w-full truncate'>
                                        <div className='font-semibold text-[10px] text-primary'>
                                          {parsedMsg.reply_to.sender_id === currentUser?.accountNo ? 'You' : 'Reply'}
                                        </div>
                                        <div className='italic line-clamp-1'>{parsedMsg.reply_to.message}</div>
                                      </div>
                                    )}

                                    {parsedMsg.file_url && (
                                      parsedMsg.file_type === 'image' ? (
                                        <div className='mb-1 overflow-hidden rounded-md border border-border bg-muted max-w-64 max-h-48 flex items-center justify-center'>
                                          <img
                                            src={getFullFileUrl(parsedMsg.file_url)}
                                            alt={parsedMsg.file_name || 'attachment'}
                                            className='object-cover max-h-48 max-w-full cursor-pointer hover:opacity-90'
                                            onClick={() => window.open(getFullFileUrl(parsedMsg.file_url), '_blank')}
                                          />
                                        </div>
                                      ) : (
                                        <a
                                          href={getFullFileUrl(parsedMsg.file_url)}
                                          target='_blank'
                                          rel='noreferrer'
                                          className='mb-2 flex items-center gap-2 rounded-md border border-border bg-card p-2 text-xs text-foreground hover:bg-muted select-none'
                                        >
                                          <div className='flex size-8 items-center justify-center rounded-md bg-destructive/10 text-destructive font-bold text-[10px]'>PDF</div>
                                          <div className='flex-1 min-w-0'>
                                            <p className='truncate font-medium'>{parsedMsg.file_name}</p>
                                            <p className='text-[10px] text-muted-foreground'>Tap to open document</p>
                                          </div>
                                        </a>
                                      )
                                    )}

                                    {parsedMsg.text && (
                                      <span className='block'>{parsedMsg.text}</span>
                                    )}

                                    <span
                                      className={cn(
                                        'mt-1 block text-xs font-light text-foreground/75 italic',
                                        isMe && 'text-end text-primary-foreground/85'
                                      )}
                                    >
                                      {format(new Date(msg.timestamp), 'h:mm a')}
                                    </span>
                                  </div>
                                  {isMe && (
                                    <Button
                                      size='icon'
                                      variant='ghost'
                                      className='opacity-0 group-hover/message:opacity-100 h-6 w-6 rounded-full shrink-0 transition-opacity'
                                      onClick={() => setReplyingTo(msg)}
                                      title='Reply to message'
                                    >
                                      <CornerUpLeft size={14} className='text-muted-foreground hover:text-primary' />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                          </Fragment>
                        ))}
                    </div>
                  </div>
                </div>
                <form className='flex w-full flex-col gap-2' onSubmit={sendMessage}>
                  {replyingTo && (
                    <div className='flex items-center justify-between rounded-t-md bg-muted/80 p-2 text-xs border-l-4 border-primary'>
                      <div className='flex-1 min-w-0'>
                        <span className='font-bold block text-primary text-[10px]'>Replying to {replyingTo.senderId === currentUser?.accountNo ? 'yourself' : 'staff'}:</span>
                        <span className='truncate block italic text-muted-foreground'>
                          {(() => {
                            try {
                              if (replyingTo.message.startsWith('{')) {
                                const parsed = JSON.parse(replyingTo.message);
                                if (parsed.is_json) return parsed.text || '[Attachment]';
                              }
                            } catch (_) {}
                            return replyingTo.message;
                          })()}
                        </span>
                      </div>
                      <Button size='icon' type='button' variant='ghost' className='h-5 w-5 rounded-full' onClick={() => setReplyingTo(null)}>
                        <X size={12} />
                      </Button>
                    </div>
                  )}
                  {uploadProgress && (
                    <div className='flex flex-col gap-2 bg-muted/50 p-2 text-xs rounded-md border border-dashed border-border'>
                      <div className='flex items-center justify-between w-full'>
                        <span className='truncate text-muted-foreground font-medium'>
                          {selectedFile?.name} ({uploadProgress})
                        </span>
                        {(uploadedFileData || uploadProgress.includes('failed') || uploadProgress.includes('Error') || uploadProgress === 'Uploaded!') && (
                          <Button size='icon' type='button' variant='ghost' className='h-5 w-5 rounded-full' onClick={() => { setSelectedFile(null); setUploadedFileData(null); setUploadProgress(null); }}>
                            <X size={12} />
                          </Button>
                        )}
                      </div>
                      {uploadedFileData && uploadedFileData.fileType === 'image' && (
                        <div className='overflow-hidden rounded-md border border-border bg-background max-w-32 max-h-24 flex items-center justify-center mt-1'>
                          <img
                            src={(() => {
                              const url = uploadedFileData.fileUrl;
                              if (url.startsWith('http')) return url;
                              const baseUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
                              return `${baseUrl}${url}`;
                            })()}
                            alt='Preview'
                            className='object-cover max-h-24 max-w-full'
                          />
                        </div>
                      )}
                      {uploadedFileData && uploadedFileData.fileType === 'pdf' && (
                        <div className='flex items-center gap-2 rounded-md border border-border bg-card p-1.5 max-w-xs mt-1'>
                          <div className='flex size-6 items-center justify-center rounded-md bg-destructive/10 text-destructive font-bold text-[8px]'>PDF</div>
                          <span className='truncate text-[10px] flex-1'>{uploadedFileData.fileName}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className='flex w-full flex-none gap-2'>
                    <div className='flex flex-1 items-center gap-2 rounded-md border border-input bg-card px-2 py-1 focus-within:ring-1 focus-within:ring-ring focus-within:outline-hidden lg:gap-4'>
                      <input type='file' ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} accept='image/*,application/pdf' />
                      <div className='space-x-1 flex items-center shrink-0'>
                        <Button size='icon' type='button' variant='ghost' className='h-8 rounded-md w-8' onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                          <Paperclip size={18} className='stroke-muted-foreground' />
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
                  </div>
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
