/**
 * Comercial Module Hooks
 * React Query hooks for CRM/Sales Pipeline management
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type {
  Prospect,
  InsertProspect,
  ProspectActivity,
  InsertProspectActivity,
  ProspectNote,
  InsertProspectNote,
  ProspectMeeting,
  InsertProspectMeeting,
  ProspectDocument,
  InsertProspectDocument,
  ProposalVersion,
  InsertProposalVersion,
  FollowUpAlert,
  ScheduledReminder,
  InsertScheduledReminder,
  LeadSourceReport,
  SalesForecastItem,
  WinLossAnalysisItem,
  CompetitorAnalysisItem,
} from "@shared/schema";

// ============================================
// PROSPECTS
// ============================================

interface ProspectFilters {
  stage?: string;
  priority?: string;
  assignedToId?: number;
  search?: string;
}

export function useProspects(filters?: ProspectFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.stage) queryParams.append('stage', filters.stage);
  if (filters?.priority) queryParams.append('priority', filters.priority);
  if (filters?.assignedToId) queryParams.append('assignedToId', filters.assignedToId.toString());
  if (filters?.search) queryParams.append('search', filters.search);

  const queryString = queryParams.toString();
  const url = `/api/comercial/prospects${queryString ? `?${queryString}` : ''}`;

  return useQuery<Prospect[]>({
    queryKey: ['comercial', 'prospects', filters],
    queryFn: async () => {
      const res = await apiRequest('GET', url);
      return res.json();
    },
    staleTime: 2 * 60 * 1000, // 2 min
  });
}

export function useProspect(id: number | null) {
  return useQuery<Prospect>({
    queryKey: ['comercial', 'prospects', id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${id}`);
      return res.json();
    },
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 min
  });
}

export function useCreateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<InsertProspect, 'companyId' | 'createdById'>) => {
      const res = await apiRequest('POST', '/api/comercial/prospects', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reports'] });
    },
  });
}

export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertProspect> }) => {
      const res = await apiRequest('PATCH', `/api/comercial/prospects/${id}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects', variables.id] });
    },
  });
}

export function useDeleteProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/comercial/prospects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reports'] });
    },
  });
}

export function useChangeProspectStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      stage,
      closedReason,
      lostToCompetitor,
    }: {
      id: number;
      stage: string;
      closedReason?: string;
      lostToCompetitor?: string;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${id}/stage`, {
        stage,
        closedReason,
        lostToCompetitor,
      });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reports'] });
    },
  });
}

// ============================================
// ACTIVITIES
// ============================================

export function useProspectActivities(prospectId: number | null) {
  return useQuery<ProspectActivity[]>({
    queryKey: ['comercial', 'activities', prospectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${prospectId}/activities`);
      return res.json();
    },
    enabled: !!prospectId,
    staleTime: 30 * 1000, // 30 sec
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      data,
    }: {
      prospectId: number;
      data: Omit<InsertProspectActivity, 'prospectId' | 'createdById'>;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/activities`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects', variables.prospectId] });
    },
  });
}

// ============================================
// NOTES
// ============================================

export function useProspectNotes(prospectId: number | null) {
  return useQuery<ProspectNote[]>({
    queryKey: ['comercial', 'notes', prospectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${prospectId}/notes`);
      return res.json();
    },
    enabled: !!prospectId,
    staleTime: 30 * 1000,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      content,
    }: {
      prospectId: number;
      content: string;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/notes`, { content });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'notes', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      noteId,
      content,
    }: {
      prospectId: number;
      noteId: number;
      content: string;
    }) => {
      const res = await apiRequest('PATCH', `/api/comercial/prospects/${prospectId}/notes/${noteId}`, { content });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'notes', variables.prospectId] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, noteId }: { prospectId: number; noteId: number }) => {
      await apiRequest('DELETE', `/api/comercial/prospects/${prospectId}/notes/${noteId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'notes', variables.prospectId] });
    },
  });
}

export function useToggleNotePin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, noteId }: { prospectId: number; noteId: number }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/notes/${noteId}/toggle-pin`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'notes', variables.prospectId] });
    },
  });
}

// ============================================
// MEETINGS
// ============================================

export function useProspectMeetings(prospectId: number | null) {
  return useQuery<ProspectMeeting[]>({
    queryKey: ['comercial', 'meetings', prospectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${prospectId}/meetings`);
      return res.json();
    },
    enabled: !!prospectId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useUpcomingMeetings(days: number = 7) {
  return useQuery<ProspectMeeting[]>({
    queryKey: ['comercial', 'meetings', 'upcoming', days],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/meetings/upcoming?days=${days}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      data,
    }: {
      prospectId: number;
      data: Omit<InsertProspectMeeting, 'prospectId' | 'createdById'>;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/meetings`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', 'upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      meetingId,
      data,
    }: {
      prospectId: number;
      meetingId: number;
      data: Partial<InsertProspectMeeting>;
    }) => {
      const res = await apiRequest('PATCH', `/api/comercial/prospects/${prospectId}/meetings/${meetingId}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', 'upcoming'] });
    },
  });
}

export function useCompleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      meetingId,
      outcome,
    }: {
      prospectId: number;
      meetingId: number;
      outcome: string;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/meetings/${meetingId}/complete`, { outcome });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', 'upcoming'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      meetingId,
      reason,
    }: {
      prospectId: number;
      meetingId: number;
      reason?: string;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/meetings/${meetingId}/cancel`, { reason });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'meetings', 'upcoming'] });
    },
  });
}

// ============================================
// DOCUMENTS
// ============================================

export function useProspectDocuments(prospectId: number | null) {
  return useQuery<ProspectDocument[]>({
    queryKey: ['comercial', 'documents', prospectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${prospectId}/documents`);
      return res.json();
    },
    enabled: !!prospectId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      data,
    }: {
      prospectId: number;
      data: Omit<InsertProspectDocument, 'prospectId' | 'uploadedById'>;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/documents`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'documents', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, docId }: { prospectId: number; docId: number }) => {
      await apiRequest('DELETE', `/api/comercial/prospects/${prospectId}/documents/${docId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'documents', variables.prospectId] });
    },
  });
}

// ============================================
// PROPOSALS
// ============================================

export function useProposalVersions(prospectId: number | null) {
  return useQuery<ProposalVersion[]>({
    queryKey: ['comercial', 'proposals', prospectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/comercial/prospects/${prospectId}/proposals`);
      return res.json();
    },
    enabled: !!prospectId,
    staleTime: 1 * 60 * 1000,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      data,
    }: {
      prospectId: number;
      data: Omit<InsertProposalVersion, 'prospectId' | 'createdById' | 'version'>;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/proposals`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'proposals', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      proposalId,
      data,
    }: {
      prospectId: number;
      proposalId: number;
      data: Partial<InsertProposalVersion>;
    }) => {
      const res = await apiRequest('PATCH', `/api/comercial/prospects/${prospectId}/proposals/${proposalId}`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'proposals', variables.prospectId] });
    },
  });
}

export function useSendProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ prospectId, proposalId }: { prospectId: number; proposalId: number }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/proposals/${proposalId}/send`);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'proposals', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'activities', variables.prospectId] });
    },
  });
}

export function useChangeProposalStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      prospectId,
      proposalId,
      status,
    }: {
      prospectId: number;
      proposalId: number;
      status: string;
    }) => {
      const res = await apiRequest('POST', `/api/comercial/prospects/${prospectId}/proposals/${proposalId}/status`, { status });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'proposals', variables.prospectId] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reports'] });
    },
  });
}

// ============================================
// ALERTS
// ============================================

export function useAlerts(status?: string) {
  const url = status ? `/api/comercial/alerts?status=${status}` : '/api/comercial/alerts';

  return useQuery<FollowUpAlert[]>({
    queryKey: ['comercial', 'alerts', status],
    queryFn: async () => {
      const res = await apiRequest('GET', url);
      return res.json();
    },
    staleTime: 1 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 min
  });
}

export function usePendingAlertsCount() {
  return useQuery<{ count: number }>({
    queryKey: ['comercial', 'alerts', 'count'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/alerts/count');
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 min
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/comercial/alerts/${id}/acknowledge`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'alerts'] });
    },
  });
}

export function useDismissAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/comercial/alerts/${id}/dismiss`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'alerts'] });
    },
  });
}

export function useGenerateAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/comercial/alerts/generate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'alerts'] });
    },
  });
}

// ============================================
// REMINDERS
// ============================================

export function useReminders() {
  return useQuery<ScheduledReminder[]>({
    queryKey: ['comercial', 'reminders'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reminders');
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<InsertScheduledReminder, 'userId'>) => {
      const res = await apiRequest('POST', '/api/comercial/reminders', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reminders'] });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertScheduledReminder> }) => {
      const res = await apiRequest('PATCH', `/api/comercial/reminders/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reminders'] });
    },
  });
}

export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/comercial/reminders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comercial', 'reminders'] });
    },
  });
}

// ============================================
// REPORTS
// ============================================

export function useLeadSourcesReport() {
  return useQuery<LeadSourceReport[]>({
    queryKey: ['comercial', 'reports', 'lead-sources'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reports/lead-sources');
      return res.json();
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });
}

export function useSalesForecast() {
  return useQuery<SalesForecastItem[]>({
    queryKey: ['comercial', 'reports', 'forecast'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reports/forecast');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useWinLossAnalysis() {
  return useQuery<{
    wins: WinLossAnalysisItem[];
    losses: WinLossAnalysisItem[];
    winRate: number;
  }>({
    queryKey: ['comercial', 'reports', 'win-loss'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reports/win-loss');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCompetitorAnalysis() {
  return useQuery<CompetitorAnalysisItem[]>({
    queryKey: ['comercial', 'reports', 'competitors'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reports/competitors');
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

interface PipelineStats {
  byStage: { stage: string; count: number; value: number }[];
  totalValue: number;
  totalProspects: number;
  weightedPipeline: number;
}

export function usePipelineStats() {
  return useQuery<PipelineStats>({
    queryKey: ['comercial', 'reports', 'pipeline'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/comercial/reports/pipeline');
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}
