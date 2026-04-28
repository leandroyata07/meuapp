import { 
  createRootRoute, 
  createRoute, 
  createRouter,
  createHashHistory,
  Outlet,
  Link
} from '@tanstack/react-router'
import React from 'react'
import { Home, Settings, FileText, UserPlus } from 'lucide-react'

import { EmployeeSearch } from './components/EmployeeSearch'
import { PinEntry } from './components/PinEntry'
import { AdminLogin } from './components/AdminLogin'
import { AdminDashboard } from './components/AdminDashboard'

// Root Route
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  ),
})

// Index Route (Employee Search)
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: EmployeeSearch,
})

// PIN Route
const pinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pin/$employeeId',
  component: PinEntry,
})

// Admin Routes
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminLogin,
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/dashboard',
  component: AdminDashboard,
})

// Create Router
const routeTree = rootRoute.addChildren([
  indexRoute,
  pinRoute,
  adminRoute,
  adminDashboardRoute
])

const hashHistory = createHashHistory()

export const router = createRouter({ 
  routeTree,
  history: hashHistory
})
