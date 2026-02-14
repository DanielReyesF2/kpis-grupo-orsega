/**
 * ContactedClientsContext - Contexto para compartir estado de clientes contactados
 * entre PriorityClientsTable y WeeklyActionsPanel
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ContactedClient {
  clientName: string;
  contactedAt: string;
}

interface ContactedClientsContextType {
  contactedClients: Map<string, string>; // clientName -> contactedAt timestamp
  markAsContacted: (clientName: string, clientId?: number | null, notes?: string, nextAction?: string, nextActionDate?: string) => Promise<void>;
  isLoading: (clientName: string) => boolean;
  getContactedAt: (clientName: string) => string | undefined;
  getRelativeTime: (clientName: string) => string | undefined;
}

const ContactedClientsContext = createContext<ContactedClientsContextType | undefined>(undefined);

interface ContactedClientsProviderProps {
  companyId: number;
  children: ReactNode;
}

export function ContactedClientsProvider({ companyId, children }: ContactedClientsProviderProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [contactedClients, setContactedClients] = useState<Map<string, string>>(new Map());
  const [loadingClients, setLoadingClients] = useState<Set<string>>(new Set());

  // Cargar clientes contactados recientemente del servidor
  const { data: recentlyContacted } = useQuery({
    queryKey: ['/api/client-contact-tracking/recent', companyId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/client-contact-tracking/recent?companyId=${companyId}&days=7`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !!companyId,
  });

  // Inicializar con datos del servidor
  useEffect(() => {
    if (recentlyContacted?.recentlyContacted) {
      const newMap = new Map<string, string>();
      recentlyContacted.recentlyContacted.forEach((item: ContactedClient) => {
        newMap.set(item.clientName, item.contactedAt);
      });
      setContactedClients(newMap);
    }
  }, [recentlyContacted]);

  const markAsContacted = useCallback(async (
    clientName: string,
    clientId?: number | null,
    notes?: string,
    nextAction?: string,
    nextActionDate?: string
  ) => {
    setLoadingClients(prev => new Set(prev).add(clientName));

    try {
      await apiRequest('POST', '/api/client-contact-tracking', {
        companyId,
        clientName,
        clientId: clientId || null,
        notes: notes || `Contactado desde Plan de Ventas`,
        nextAction,
        nextActionDate,
      });

      // Actualizar estado local
      const now = new Date().toISOString();
      setContactedClients(prev => new Map(prev).set(clientName, now));

      // Invalidar queries
      queryClient.invalidateQueries({ queryKey: ['/api/client-contact-tracking'] });

      toast({
        title: 'Cliente contactado',
        description: `${clientName} marcado como contactado`,
      });
    } catch (error) {
      console.error('Error marking client as contacted:', error);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el contacto',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoadingClients(prev => {
        const newSet = new Set(prev);
        newSet.delete(clientName);
        return newSet;
      });
    }
  }, [companyId, queryClient, toast]);

  const isLoading = useCallback((clientName: string) => {
    return loadingClients.has(clientName);
  }, [loadingClients]);

  const getContactedAt = useCallback((clientName: string) => {
    return contactedClients.get(clientName);
  }, [contactedClients]);

  const getRelativeTime = useCallback((clientName: string) => {
    const contactedAt = contactedClients.get(clientName);
    if (!contactedAt) return undefined;

    const date = new Date(contactedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return diffMins <= 1 ? 'Contactado hace un momento' : `Contactado hace ${diffMins} min`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? 'Contactado hace 1 hora' : `Contactado hace ${diffHours} horas`;
    } else if (diffDays === 0) {
      return 'Contactado hoy';
    } else if (diffDays === 1) {
      return 'Contactado ayer';
    } else {
      return `Contactado hace ${diffDays} dias`;
    }
  }, [contactedClients]);

  return (
    <ContactedClientsContext.Provider
      value={{
        contactedClients,
        markAsContacted,
        isLoading,
        getContactedAt,
        getRelativeTime,
      }}
    >
      {children}
    </ContactedClientsContext.Provider>
  );
}

export function useContactedClients() {
  const context = useContext(ContactedClientsContext);
  if (context === undefined) {
    throw new Error('useContactedClients must be used within a ContactedClientsProvider');
  }
  return context;
}
