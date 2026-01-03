import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";

export interface UseFiltersOptions {
  syncWithURL?: boolean;
  persistInLocalStorage?: boolean;
  storageKey?: string;
}

export function useFilters<T extends Record<string, any>>(
  initialFilters: T = {} as T,
  options: UseFiltersOptions = {}
) {
  const { syncWithURL = true, persistInLocalStorage = false, storageKey = 'filters' } = options;
  const [location, setLocation] = useLocation();

  // Load from localStorage if enabled
  const getInitialFilters = useCallback(() => {
    if (persistInLocalStorage) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (e) {
        console.error('Error loading filters from localStorage:', e);
      }
    }
    return initialFilters;
  }, [persistInLocalStorage, storageKey, initialFilters]);

  // Load from URL if enabled
  const getFiltersFromURL = useCallback(() => {
    if (syncWithURL) {
      const params = new URLSearchParams(window.location.search);
      const urlFilters: Partial<T> = {};
      params.forEach((value, key) => {
        (urlFilters as any)[key] = value;
      });
      return urlFilters;
    }
    return {};
  }, [syncWithURL]);

  const [filters, setFilters] = useState<T>(() => {
    const urlFilters = getFiltersFromURL();
    const localFilters = getInitialFilters();
    return { ...localFilters, ...urlFilters } as T;
  });

  // Sync with URL
  useEffect(() => {
    if (syncWithURL) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
          params.set(key, String(value));
        }
      });
      const newSearch = params.toString();
      const newLocation = location.split('?')[0] + (newSearch ? `?${newSearch}` : '');
      if (newLocation !== location) {
        setLocation(newLocation, { replace: true });
      }
    }
  }, [filters, syncWithURL, location, setLocation]);

  // Persist in localStorage
  useEffect(() => {
    if (persistInLocalStorage) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(filters));
      } catch (e) {
        console.error('Error saving filters to localStorage:', e);
      }
    }
  }, [filters, persistInLocalStorage, storageKey]);

  const updateFilters = useCallback((newFilters: Partial<T>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const removeFilter = useCallback((key: keyof T) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  return {
    filters,
    updateFilters,
    clearFilters,
    removeFilter,
    setFilters,
  };
}

