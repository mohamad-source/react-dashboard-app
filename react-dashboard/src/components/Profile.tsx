import { useUser } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Mail, User, Calendar, Shield } from 'lucide-react'
import DashboardLayout from './DashboardLayout'

export default function Profile() {
  const { user } = useUser()

  if (!user) {
    return <div>Laden...</div>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Benutzer Profil</CardTitle>
          <CardDescription>
            Hier können Sie Ihre Profilinformationen einsehen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.imageUrl} alt={`${user.firstName} ${user.lastName}`} />
              <AvatarFallback className="text-lg">
                {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-xl font-semibold">
                  {user.firstName} {user.lastName}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={user.publicMetadata?.role === 'admin' ? 'default' : 'secondary'}>
                    {user.publicMetadata?.role === 'admin' ? 'Administrator' : 'Benutzer'}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">E-Mail</p>
                    <p className="text-sm text-muted-foreground">
                      {user.emailAddresses[0]?.emailAddress}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">E-Mail Status</p>
                    <p className="text-sm text-muted-foreground">
                      {user.emailAddresses[0]?.verification.status === 'verified'
                        ? 'Verifiziert'
                        : 'Nicht verifiziert'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Benutzer ID</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {user.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Erstellt am</p>
                    <p className="text-sm text-muted-foreground">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('de-DE') : 'Unbekannt'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konto Informationen</CardTitle>
          <CardDescription>
            Zusätzliche Details zu Ihrem Konto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Anmelde-Methoden</h4>
              <div className="flex gap-2">
                <Badge variant="outline">E-Mail + Passwort</Badge>
                {user.emailAddresses[0]?.verification.status === 'verified' && (
                  <Badge variant="outline">E-Mail verifiziert</Badge>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Berechtigungen</h4>
              <div className="text-sm text-muted-foreground">
                {user.publicMetadata?.role === 'admin' ? (
                  <p>Sie haben Administrator-Berechtigung und können alle Funktionen nutzen.</p>
                ) : (
                  <p>Sie haben Standard-Benutzer-Berechtigung.</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Letzte Aktualisierung</h4>
              <p className="text-sm text-muted-foreground">
                {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('de-DE') : 'Unbekannt'} um{' '}
                {user.updatedAt ? new Date(user.updatedAt).toLocaleTimeString('de-DE') : 'Unbekannt'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  )
}
