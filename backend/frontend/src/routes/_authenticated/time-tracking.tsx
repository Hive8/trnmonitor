import { createFileRoute } from '@tanstack/react-router'
import { TimeTracking } from '@/features/time-tracking'

export const Route = createFileRoute('/_authenticated/time-tracking')({
  component: TimeTracking,
})
