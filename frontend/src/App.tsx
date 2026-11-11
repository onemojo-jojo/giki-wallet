import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from '@/shared/components/ui/sonner';
import { useAuthStore } from '@/shared/stores/authStore';

// Layout components
import { ClientLayout } from '@/client/layout/ClientLayout';
import { AdminLayout } from '@/admin/layout/AdminLayout';
import { AuthLayout } from '@/shared/modules/auth/layout/AuthLayout';
import { RequireAuth } from '@/shared/modules/auth/components/RequireAuth';
import { AdminProtectedRoute } from '@/admin/components/AdminProtectedRoute';

// Admin components
import { TicketsPage as AdminTicketsPage } from '@/admin/modules/tickets/pages/TicketsPage';
import { UsersPage } from '@/admin/modules/users/pages/UsersPage';
import { TransactionsPage } from '@/admin/modules/transactions/pages/TransactionsPage';
import { GatewayTransactionsPage } from '@/admin/modules/gateway-transactions/pages/GatewayTransactionsPage';
import { HistoryPage } from '@/admin/modules/history/pages/HistoryPage';
import { CreateTripPage } from '@/admin/modules/trips/pages/CreateTripPage';
import { TripsPage } from '@/admin/modules/trips/pages/TripsPage';
import { WorkerStatusPage } from '@/admin/modules/system/pages/WorkerStatusPage';
import { SystemLogsPage } from '@/admin/modules/system/pages/SystemLogsPage';
import { SettingsPage } from '@/admin/modules/settings/pages/SettingsPage';

// Client components
import { HomePage } from '@/client/pages/HomePage';
import AboutPage from '@/client/pages/AboutPage';
import { TransportPage } from '@/client/modules/transport/pages/TransportPage';
import TopUpPage from '@/client/modules/wallet/pages/TopUpPage';
import PaymentResultPage from '@/client/modules/wallet/pages/PaymentResultPage';
import { TicketsPage } from '@/client/modules/transport/pages/TicketsPage';
import BookingConfirmationPage from '@/client/modules/transport/pages/BookingConfirmationPage';
import { WalletTabPage } from '@/client/modules/wallet/pages/WalletTabPage';
import { ReceiptPage } from '@/client/modules/wallet/pages/ReceiptPage';
import { CampusPage } from '@/client/modules/campus/pages/CampusPage';
import PassengerDetailsPage from '@/client/modules/transport/pages/PassengerDetailsPage';
import ReviewPage from '@/client/modules/transport/pages/ReviewPage';
import BookedPage from '@/client/modules/transport/pages/BookedPage';

// Shared components
import { AccountPage } from '@/shared/modules/auth/pages/AccountPage';
// Admin sign-in keeps its original page and layout.
import { SignInPage as AdminSignInPage } from '@/shared/modules/auth/pages/SignInPage';

// Student / staff auth (v2 designs)
import WelcomePage from '@/client/modules/auth/pages/WelcomePage';
import SignInPage from '@/client/modules/auth/pages/SignInPage';
import SignUpPage from '@/client/modules/auth/pages/SignUpPage';
import VerifyEmailPage from '@/client/modules/auth/pages/VerifyEmailPage';
import ForgotPasswordPage from '@/client/modules/auth/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/client/modules/auth/pages/ResetPasswordPage';

const LoadingSpinner = () => (
    <div className="min-h-[100vh] flex flex-col items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Loading GIKI Wallet...</p>
    </div>
);

const router = createBrowserRouter([
    { path: '/auth/welcome', element: <WelcomePage /> },
    { path: '/auth/sign-in', element: <SignInPage /> },
    { path: '/auth/sign-up', element: <SignUpPage /> },
    { path: '/auth/verify', element: <VerifyEmailPage /> },
    { path: '/auth/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/auth/reset-password', element: <ResetPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> },
    { path: '/verify', element: <VerifyEmailPage /> },
    {
        path: '/admin/signin',
        element: (
            <AuthLayout>
                <AdminSignInPage />
            </AuthLayout>
        ),
    },
    {
        path: '/',
        element: (
            <ClientLayout>
                <HomePage />
            </ClientLayout>
        ),
    },
    {
        path: '/about',
        element: (
            <ClientLayout>
                <AboutPage />
            </ClientLayout>
        ),
    },
    {
        path: '/campus',
        element: (
            <ClientLayout>
                <CampusPage />
            </ClientLayout>
        ),
    },
    {
        path: '/wallet',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            {
                index: true,
                element: <WalletTabPage />,
            },
            {
                path: 'receipt/:id',
                element: <ReceiptPage />,
            },
        ],
    },
    {
        path: '/transport',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            {
                index: true,
                element: <TransportPage />,
            },
            {
                path: 'confirm',
                element: <BookingConfirmationPage />,
            },
            {
                path: 'passengers',
                element: <PassengerDetailsPage />,
            },
            {
                path: 'review',
                element: <ReviewPage />,
            },
            {
                path: 'booked',
                element: <BookedPage />,
            },
        ],
    },
    {
        path: '/top-up',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            {
                index: true,
                element: <TopUpPage />,
            },
        ],
    },
    {
        path: '/payment',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            { path: 'success', element: <PaymentResultPage /> },
            { path: 'failed', element: <PaymentResultPage /> },
            { path: 'error', element: <PaymentResultPage /> },
            { path: 'pending', element: <PaymentResultPage /> },
        ],
    },
    {
        path: '/tickets',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            {
                index: true,
                element: <TicketsPage />,
            },
        ],
    },
    {
        path: '/account',
        element: (
            <ClientLayout>
                <RequireAuth />
            </ClientLayout>
        ),
        children: [
            {
                index: true,
                element: <AccountPage />,
            },
        ],
    },
    {
        element: (
            <AdminLayout>
                <AdminProtectedRoute />
            </AdminLayout>
        ),
        children: [
            {
                path: '/admin',
                index: true,
                element: <Navigate to="/admin/tickets" replace />,
            },
            {
                path: '/admin/trips',
                element: <TripsPage />,
            },
            {
                path: '/admin/tickets',
                element: <AdminTicketsPage />,
            },

            {
                path: '/admin/users',
                element: <UsersPage />,
            },
            {
                path: '/admin/transactions',
                element: <TransactionsPage />,
            },
            {
                path: '/admin/gateway-transactions',
                element: <GatewayTransactionsPage />,
            },
            {
                path: '/admin/history',
                element: <HistoryPage />,
            },
            {
                path: '/admin/trips/new',
                element: <CreateTripPage />,
            },
            {
                path: '/admin/system',
                element: <WorkerStatusPage />,
            },
            {
                path: '/admin/logs',
                element: <SystemLogsPage />,
            },
            {
                path: '/admin/settings',
                element: <SettingsPage />,
            },
        ],
    },
    {
        path: '*',
        element: <Navigate to="/" replace />,
    },
]);

function App() {
    const { loadMe, initialized } = useAuthStore();

    useEffect(() => {
        void loadMe();
    }, [loadMe]);

    if (!initialized) {
        return <LoadingSpinner />;
    }

    return (
        <>
            <RouterProvider router={router} />
            <Toaster />
        </>
    );
}

export default App;