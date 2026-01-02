import { useState, useCallback } from "react";

export interface DocumentViewerState {
  isOpen: boolean;
  currentDocument: {
    url: string;
    name: string;
    type: "pdf" | "image";
  } | null;
  zoom: number;
  rotation: number;
}

export function useDocumentViewer() {
  const [state, setState] = useState<DocumentViewerState>({
    isOpen: false,
    currentDocument: null,
    zoom: 1,
    rotation: 0,
  });

  const openDocument = useCallback((url: string, name: string, type: "pdf" | "image") => {
    setState({
      isOpen: true,
      currentDocument: { url, name, type },
      zoom: 1,
      rotation: 0,
    });
  }, []);

  const closeDocument = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      currentDocument: null,
    }));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setState((prev) => ({ ...prev, zoom }));
  }, []);

  const setRotation = useCallback((rotation: number) => {
    setState((prev) => ({ ...prev, rotation }));
  }, []);

  return {
    ...state,
    openDocument,
    closeDocument,
    setZoom,
    setRotation,
  };
}

