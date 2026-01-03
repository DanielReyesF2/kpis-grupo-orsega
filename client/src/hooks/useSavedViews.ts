import { useState, useEffect, useCallback } from "react";

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

const STORAGE_KEY = 'saved_views';

export function useSavedViews() {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSavedViews(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading saved views:', e);
    }
  }, []);

  // Save to localStorage whenever savedViews changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedViews));
    } catch (e) {
      console.error('Error saving views:', e);
    }
  }, [savedViews]);

  const saveView = useCallback((name: string, filters: Record<string, any>) => {
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name,
      filters,
      createdAt: new Date().toISOString(),
    };
    setSavedViews(prev => [...prev, newView]);
    return newView.id;
  }, []);

  const updateView = useCallback((id: string, updates: Partial<SavedView>) => {
    setSavedViews(prev =>
      prev.map(view =>
        view.id === id
          ? { ...view, ...updates, updatedAt: new Date().toISOString() }
          : view
      )
    );
  }, []);

  const deleteView = useCallback((id: string) => {
    setSavedViews(prev => prev.filter(view => view.id !== id));
  }, []);

  const getView = useCallback((id: string) => {
    return savedViews.find(view => view.id === id);
  }, [savedViews]);

  const loadView = useCallback((id: string) => {
    const view = getView(id);
    return view?.filters || null;
  }, [getView]);

  return {
    savedViews,
    saveView,
    updateView,
    deleteView,
    getView,
    loadView,
  };
}

