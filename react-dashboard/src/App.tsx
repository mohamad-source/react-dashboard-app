import { SignIn, SignUp, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import { DashboardSkeleton } from './components/ui/skeleton'

const Dashboard = lazy(() => import('./components/Dashboard'))
const Profile = lazy(() => import('./components/Profile'))
const EditProfile = lazy(() => import('./components/EditProfile'))
const AkteForm = lazy(() => import('./components/forms/AkteForm'))
const AktenListe = lazy(() => import('./components/AktenListe'))

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-64">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">Wird geladen...</p>
    </div>
  </div>
)


function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                Willkommen im Dashboard
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Melden Sie sich an oder registrieren Sie sich
              </p>
            </div>
            <Routes>
              <Route path="/sign-in" element={
                <div className="flex justify-center">
                  <SignIn
                    redirectUrl="/dashboard"
                    signUpUrl="/sign-up"
                  />
                </div>
              } />
              <Route path="/sign-up" element={
                <div className="flex justify-center">
                  <SignUp
                    redirectUrl="/dashboard"
                    signInUrl="/sign-in"
                  />
                </div>
              } />
              <Route path="*" element={<Navigate to="/sign-in" replace />} />
            </Routes>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <Suspense fallback={<DashboardSkeleton />}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/akten" element={<AktenListe />} />
            <Route path="/akte-neu" element={<AkteForm />} />
            <Route path="/akte-bearbeiten/:id" element={<AkteForm />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/edit-profile" element={<EditProfile />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </SignedIn>
      </div>
    </ErrorBoundary>
  )
}

export default App
