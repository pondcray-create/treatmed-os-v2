"use client"

import { useEffect, useMemo, useState } from "react"
import { readJobs, type ASServiceJob } from "@/lib/mock/as-store"
import {
  canTransition,
  getAvailableNextLegacyStatuses,
  getAvailableTransitions,
  getStateVisual,
  subscribeJobStateChanges,
  transitionJobToLegacyStatus,
  transitionJobState,
  type JobActorRole,
  type JobFsmState,
} from "@/lib/as-job-fsm"

export function useJobStateMachine(actorRole: JobActorRole) {
  const [jobs, setJobs] = useState<ASServiceJob[]>([])

  useEffect(() => {
    setJobs(readJobs([]))
    return subscribeJobStateChanges(setJobs)
  }, [])

  const api = useMemo(
    () => ({
      jobs,
      canTransition: (job: ASServiceJob, to: JobFsmState) => canTransition(job, to, actorRole),
      getAvailableTransitions: (job: ASServiceJob) => getAvailableTransitions(job, actorRole),
      getAvailableNextStatuses: (job: ASServiceJob) => getAvailableNextLegacyStatuses(job, actorRole),
      transitionJobState: (jobId: string, to: JobFsmState) => transitionJobState(jobId, to, actorRole),
      transitionToStatus: (jobId: string, toStatus: ASServiceJob["status"]) =>
        transitionJobToLegacyStatus(jobId, toStatus, actorRole),
      getStateVisual,
    }),
    [jobs, actorRole],
  )

  return api
}

