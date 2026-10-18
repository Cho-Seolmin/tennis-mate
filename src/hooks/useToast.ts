import { create } from 'zustand'
import type { ToastTone } from '../types/index.ts'

export type ToastInput = {
  message: string
  tone: ToastTone
}

type ToastRecord = ToastInput & {
  id: string
}

type ToastState = {
  toasts: ToastRecord[]
  push: (toast: ToastInput) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID()

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))

    window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((item) => item.id !== id),
      }))
    }, 4000)
  },
  dismiss: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((item) => item.id !== id),
    }))
  },
}))

export function useToast() {
  const push = useToastStore((state) => state.push)

  return { push }
}
