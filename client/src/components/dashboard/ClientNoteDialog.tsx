/**
 * ClientNoteDialog - Dialog para ver y agregar notas de contexto a un cliente
 * Ejemplo: "Solo compra urgencias/devoluciones de importacion"
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, StickyNote, Trash2, Plus, Clock } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `hace ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  return format(date, 'dd MMM yyyy', { locale: es });
}

interface ClientNoteDialogProps {
  clientName: string;
  companyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClientNote {
  id: number;
  clientName: string;
  note: string;
  category: string | null;
  createdByName: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'comportamiento', label: 'Comportamiento de compra' },
  { value: 'restriccion', label: 'Restriccion comercial' },
  { value: 'preferencia', label: 'Preferencia del cliente' },
  { value: 'historial', label: 'Historial importante' },
  { value: 'otro', label: 'Otro' },
];

export function ClientNoteDialog({
  clientName,
  companyId,
  open,
  onOpenChange,
}: ClientNoteDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [newCategory, setNewCategory] = useState<string>('comportamiento');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch existing notes for this client
  const { data: notes = [], isLoading: notesLoading } = useQuery({
    queryKey: ['/api/client-notes', companyId, clientName],
    queryFn: async () => {
      const res = await apiRequest(
        'GET',
        `/api/client-notes?companyId=${companyId}&clientName=${encodeURIComponent(clientName)}`
      );
      return res.json() as Promise<ClientNote[]>;
    },
    enabled: open,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: { note: string; category: string }) => {
      const res = await apiRequest('POST', '/api/client-notes', {
        companyId,
        clientName,
        note: data.note,
        category: data.category,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Nota guardada',
        description: `Nota agregada a ${clientName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/client-notes', companyId, clientName] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-notes/summary', companyId] });
      setNewNote('');
      setNewCategory('comportamiento');
      setShowAddForm(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la nota',
        variant: 'destructive',
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const res = await apiRequest('DELETE', `/api/client-notes/${noteId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Nota eliminada',
        description: 'La nota fue eliminada correctamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/client-notes', companyId, clientName] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-notes/summary', companyId] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la nota',
        variant: 'destructive',
      });
    },
  });

  const handleSaveNote = () => {
    if (!newNote.trim()) return;
    createNoteMutation.mutate({ note: newNote.trim(), category: newCategory });
  };

  const getCategoryBadge = (category: string | null) => {
    const cat = CATEGORIES.find((c) => c.value === category);
    return cat ? cat.label : category || 'Sin categoria';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-amber-500" />
            Notas de cliente
          </DialogTitle>
          <DialogDescription className="truncate">
            Contexto y observaciones para <span className="font-semibold">{clientName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Existing notes */}
          {notesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 && !showAddForm ? (
            <div className="text-center py-8 text-muted-foreground">
              <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay notas para este cliente</p>
              <p className="text-sm mt-1">Agrega contexto relevante</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border bg-muted/30 p-3 group relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">
                      {getCategoryBadge(note.category)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      disabled={deleteNoteMutation.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm mt-2">{note.note}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatRelativeTime(note.createdAt)}
                    </span>
                    {note.createdByName && (
                      <>
                        <span>•</span>
                        <span>{note.createdByName}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new note form */}
          {showAddForm && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="note">Nota</Label>
                <Textarea
                  id="note"
                  placeholder="Ej: Solo compra urgencias/devoluciones de importacion"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                <span className="text-xs text-muted-foreground text-right">
                  {newNote.length}/1000
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewNote('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNote}
                  disabled={!newNote.trim() || createNoteMutation.isPending}
                >
                  {createNoteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : null}
                  Guardar nota
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!showAddForm && (
            <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1" />
              Agregar nota
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
