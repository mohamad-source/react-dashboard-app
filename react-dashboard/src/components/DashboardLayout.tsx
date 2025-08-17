import type { ReactNode } from 'react'
import { UserButton, useUser } from '@clerk/clerk-react'
import { useClerk } from '@clerk/clerk-react'
import { LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  User,
  Edit,
  Home
} from 'lucide-react'

const getMenuItems = (isAdmin: boolean) => [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/dashboard',
    description: 'Übersicht und Statistiken'
  },
  {
    title: 'Profil',
    icon: User,
    href: '/profile',
    description: 'Ihr Benutzerprofil anzeigen'
  },
  {
    title: 'Profil bearbeiten',
    icon: Edit,
    href: '/edit-profile',
    description: 'Profildaten bearbeiten'
  }
]

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user } = useUser()
  const location = useLocation()
  const currentPath = location.pathname
  const { signOut } = useClerk()

  const isAdmin = user?.publicMetadata?.role === 'admin'
  const menuItems = getMenuItems(isAdmin)

  const currentMenuItem = menuItems.find(item => item.href === currentPath)

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.imageUrl} />
                <AvatarFallback>
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <h3 className="font-semibold text-sm">
                  {user?.firstName} {user?.lastName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {user?.publicMetadata?.role === 'admin' ? 'Administrator' : 'Benutzer'}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={currentPath === item.href}>
                    <Link to={item.href} className="flex items-center gap-3 p-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t p-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start gap-2" 
              onClick={() => signOut({ redirectUrl: '/sign-in' })}
            >
              <LogOut className="h-4 w-4" />
              Abmelden
            </Button>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-6">
              <SidebarTrigger />
              <div className="flex-1">
                <h1 className="text-xl font-semibold">
                  {currentMenuItem?.title || 'Dashboard'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentMenuItem?.description || 'Willkommen in Ihrem Dashboard'}
                </p>
              </div>
            </div>
          </header>

          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}