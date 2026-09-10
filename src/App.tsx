import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Landing } from '@/pages/Landing'
import { Dashboard } from '@/pages/Dashboard'
import { ProductList } from '@/pages/ProductList'
import { ProductDetail } from '@/pages/ProductDetail'
import { AddProduct } from '@/pages/AddProduct'
import { AddProductManually } from '@/pages/AddProductManually'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { Settings } from '@/pages/Settings'
import { TeamHub } from '@/pages/app/TeamHub'
import { Tasks } from '@/pages/app/Tasks'
import { Files } from '@/pages/app/Files'
import { Discussions } from '@/pages/app/Discussions'
import { CreativeLab } from '@/pages/app/CreativeLab'
import { LandingPageBuilder } from '@/pages/app/LandingPage'
import { VideoImagesCreation } from '@/pages/app/VideoImages'
import { CODCenter } from '@/pages/app/CODCenter'
import { Orders } from '@/pages/app/Orders'
import { Delivery } from '@/pages/app/Delivery'
import { DeliveryCompanies } from '@/pages/app/DeliveryCompanies'
import { Finance } from '@/pages/app/Finance'
import { Analytics } from '@/pages/app/Analytics'
import { Winners } from '@/pages/app/Winners'
import { ConfirmationMessages } from '@/pages/app/ConfirmationMessages'
import ProductSelling from '@/pages/app/ProductSelling'
import YouCanOrdersPage from '@/pages/app/YouCanOrders'
import { Profile } from '@/pages/app/Profile'
import { TeamManagement } from '@/pages/app/TeamManagement'
import { Commissions } from '@/pages/app/Commissions'
import { InviteAcceptPage } from '@/pages/auth/InviteAccept'
import { LoginPage } from '@/pages/auth/Login'
import { RegisterPage } from '@/pages/auth/Register'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPassword'
import { ResetPasswordPage } from '@/pages/auth/ResetPassword'
import { AuthCallbackPage } from '@/pages/auth/AuthCallback'
import { CompleteProfilePage } from '@/pages/auth/CompleteProfile'
import { PendingApprovalPage, AccountRejectedPage, AccountSuspendedPage, AccountBlockedPage, AccountBannedPage } from '@/components/auth/StatusPages'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/complete-profile" element={<CompleteProfilePage />} />
        </Route>

        {/* Public invitation acceptance */}
        <Route path="/team/invite/:token" element={<InviteAcceptPage />} />

        {/* Status Pages */}
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/account-rejected" element={<AccountRejectedPage />} />
        <Route path="/account-suspended" element={<AccountSuspendedPage />} />
        <Route path="/account-blocked" element={<AccountBlockedPage />} />
        <Route path="/account-banned" element={<AccountBannedPage />} />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="research" element={<ProductList />} />
            <Route path="research/new" element={<AddProduct />} />
            <Route path="research/add-manually" element={<AddProductManually />} />
            <Route path="research/:id" element={<ProductDetail />} />
            <Route path="calculator" element={<CalculatorPage />} />
            <Route path="winners" element={<Winners />} />
            <Route path="product-selling" element={<ProductSelling />} />
            <Route path="team" element={<TeamHub />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="files" element={<Files />} />
            <Route path="commissions" element={<Commissions />} />
            <Route path="discussions" element={<Discussions />} />
            <Route path="creative" element={<CreativeLab />} />
            <Route path="landing-pages" element={<LandingPageBuilder />} />
            <Route path="video-images" element={<VideoImagesCreation />} />
            <Route path="cod" element={<CODCenter />} />
            <Route path="youcan-orders" element={<YouCanOrdersPage />} />
            <Route path="orders" element={<Orders />} />
            <Route path="confirmation" element={<ConfirmationMessages />} />
            <Route path="delivery" element={<Delivery />} />
            <Route path="delivery-companies" element={<DeliveryCompanies />} />
            <Route path="finance" element={<Finance />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="team-management" element={<TeamManagement />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
