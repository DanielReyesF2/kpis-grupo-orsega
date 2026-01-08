import { useQuery, UseQueryResult } from '@tanstack/react-query';
import type { CollaboratorPerformanceResponse } from '../types/collaborator';

interface UseCollaboratorPerformanceOptions {
  companyId?: number | null;
  enabled?: boolean;
  refetchInterval?: number | false;
  staleTime?: number;
}

/**
 * Custom hook to fetch collaborator performance data with historical compliance
 * and advanced trend analysis using linear regression.
 *
 * Features:
 * - 12-month historical compliance data per collaborator
 * - Advanced trend analysis (direction, strength, R²)
 * - Automatic caching (5-minute TTL on backend)
 * - Optimized SQL queries for performance
 *
 * @param options Configuration options
 * @returns React Query result with collaborator performance data
 */
export function useCollaboratorPerformance(
  options: UseCollaboratorPerformanceOptions = {}
): UseQueryResult<CollaboratorPerformanceResponse, Error> {
  const {
    companyId = null,
    enabled = true,
    refetchInterval = false,
    staleTime = 2 * 60 * 1000, // 2 minutes default
  } = options;

  return useQuery<CollaboratorPerformanceResponse, Error>({
    queryKey: ['/api/collaborators-performance', { companyId }],
    staleTime,
    refetchInterval,
    enabled,
    retry: 1,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
}
