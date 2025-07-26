import { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Save, Upload, AlertCircle, CheckCircle } from 'lucide-react'
import DashboardLayout from './DashboardLayout'

export default function EditProfile() {
  const { user } = useUser()
  const [firstName, setFirstName] = useState(user?.firstName || '')
  const [lastName, setLastName] = useState(user?.lastName || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    setMessage(null)

    try {
      await user.update({
        firstName,
        lastName,
      })
      setMessage({ type: 'success', text: 'Profil erfolgreich aktualisiert!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren des Profils.' })
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !event.target.files?.[0]) return

    setLoading(true)
    setMessage(null)

    try {
      await user.setProfileImage({ file: event.target.files[0] })
      setMessage({ type: 'success', text: 'Profilbild erfolgreich aktualisiert!' })
    } catch (error) {
      setMessage({ type: 'error', text: 'Fehler beim Hochladen des Profilbildes.' })
      console.error('Error uploading image:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div>Laden...</div>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil bearbeiten</CardTitle>
          <CardDescription>
            Aktualisieren Sie Ihre Profilinformationen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.imageUrl} alt={`${user.firstName} ${user.lastName}`} />
                <AvatarFallback className="text-lg">
                  {firstName.charAt(0)}{lastName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="image-upload"
                className="absolute -bottom-2 -right-2 cursor-pointer bg-primary text-primary-foreground rounded-full p-2 hover:bg-primary/90 transition-colors"
              >
                <Upload className="h-4 w-4" />
              </Label>
              <Input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={loading}
              />
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Profilbild</h3>
              <p className="text-sm text-muted-foreground">
                Klicken Sie auf das Upload-Symbol, um ein neues Profilbild hochzuladen.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Vorname</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
placeholder=""
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Nachname</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
placeholder=""
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>E-Mail</Label>
            <Input
              value={user.emailAddresses[0]?.emailAddress || ''}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Die E-Mail-Adresse kann nicht hier geändert werden.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSave}
              disabled={loading || (!firstName.trim() || !lastName.trim())}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Speichern...' : 'Änderungen speichern'}
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setFirstName(user.firstName || '')
                setLastName(user.lastName || '')
                setMessage(null)
              }}
              disabled={loading}
            >
              Zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Konto Sicherheit</CardTitle>
          <CardDescription>
            Verwalten Sie Ihre Sicherheitseinstellungen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2">Passwort</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Das Passwort wird über Clerk verwaltet und kann nicht hier geändert werden.
              </p>
              <Button variant="outline" size="sm">
                Passwort ändern (über Clerk)
              </Button>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">E-Mail Verifizierung</h4>
              <p className="text-sm text-muted-foreground">
                Status: {user.emailAddresses[0]?.verification.status === 'verified'
                  ? 'Verifiziert ✓'
                  : 'Nicht verifiziert'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  )
}
