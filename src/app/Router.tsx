import { createBrowserRouter, RouterProvider } from 'react-router'
import { appRoutes } from './routes.tsx'

const router = createBrowserRouter(appRoutes)

export function AppRouter() {
  return <RouterProvider router={router} />
}
