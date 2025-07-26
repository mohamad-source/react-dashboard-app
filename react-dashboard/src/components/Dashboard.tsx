import { useUser } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import DashboardLayout from './DashboardLayout'

import {
  User,
  Edit,
  FileText,
  Home
} from 'lucide-react'



export default function Dashboard() {
  const { user } = useUser()

  return (
    <DashboardLayout>
      <div className="dashboard-grid space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="stat-card card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Willkommen
              </CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {user?.firstName}
              </div>
              <p className="text-xs text-muted-foreground">
                Sie sind als {user?.publicMetadata?.role === 'admin' ? 'Administrator' : 'Benutzer'} angemeldet
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Email Status
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {user?.emailAddresses[0]?.verification.status === 'verified' ? 'Verifiziert' : 'Nicht verifiziert'}
              </div>
              <p className="text-xs text-muted-foreground">
                {user?.emailAddresses[0]?.emailAddress}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Letzter Login
              </CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {user?.lastSignInAt ? new Date(user.lastSignInAt).toLocaleDateString('de-DE') : 'Unbekannt'}
              </div>
              <p className="text-xs text-muted-foreground">
                Letzter Login
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card card-enhanced">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Aktionen
              </CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/profile">Profil anzeigen</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link to="/edit-profile">Profil bearbeiten</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dashboard Übersicht</CardTitle>
            <CardDescription>
              Hier finden Sie eine Übersicht über die wichtigsten Funktionen Ihres Dashboards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <CardTitle className="text-base">Profil</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3">
                    Ihr Benutzerprofil anzeigen
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/profile">Öffnen</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    <CardTitle className="text-base">Profil bearbeiten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3">
                    Profildaten bearbeiten
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/edit-profile">Öffnen</Link>
                  </Button>
                </CardContent>
              </Card>

              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle className="text-base">Akten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground mb-3">
                    Dateien und Dokumente verwalten
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/files">Öffnen</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
