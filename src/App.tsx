import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth'
import ProtectedRoute from '@/components/ProtectedRoute'
import AdminLayout from '@/components/AdminLayout'

// Páginas Administrativas
import Login from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import AreasPage from '@/pages/Areas'
import CampaignsPage from '@/pages/Campaigns'
import ParticipantsPage from '@/pages/Participants'
import DispatchesPage from '@/pages/Dispatches'

// Página Pública de Avaliação
import SurveyPage from '@/pages/Survey'

import NotFound from '@/pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Rotas de Autenticação */}
          <Route path="/login" element={<Login />} />

          {/* Rotas Administrativas Protegidas */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <DashboardPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/areas"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <AreasPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/campanhas"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <CampaignsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/participantes"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <ParticipantsPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/envios"
            element={
              <ProtectedRoute>
                <AdminLayout>
                  <DispatchesPage />
                </AdminLayout>
              </ProtectedRoute>
            }
          />

          {/* Rotas Públicas de Avaliação */}
          <Route path="/avaliar/:token" element={<SurveyPage />} />
          <Route path="/avaliar/aberto/:slug" element={<SurveyPage />} />

          {/* Redirecionamento da raiz para /admin ou /login */}
          <Route path="/" element={<Navigate to="/admin" replace />} />

          {/* Página 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
