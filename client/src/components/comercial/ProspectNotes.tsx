import { useState } from "react";
import { formatDistance } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Pin,
  PinOff,
  MoreVertical,
  Trash2,
  Edit,
  FileText,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useProspectNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useToggleNotePin,
} from "@/hooks/useComercial";

interface ProspectNotesProps {
  prospectId: number;
}

export function ProspectNotes({ prospectId }: ProspectNotesProps) {
  const { toast } = useToast();
  const [newNote, setNewNote] = useState("");
  const [editingNote, setEditingNote] = useState<{ id: number; content: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: notes = [], isLoading } = useProspectNotes(prospectId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const togglePin = useToggleNotePin();

  const handleCreateNote = async () => {
    if (!newNote.trim()) return;

    try {
      await createNote.mutateAsync({
        prospectId,
        content: newNote.trim(),
      });
      setNewNote("");
      toast({
        title: "Nota creada",
        description: "La nota se agrego correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la nota",
        variant: "destructive",
      });
    }
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !editingNote.content.trim()) return;

    try {
      await updateNote.mutateAsync({
        prospectId,
        noteId: editingNote.id,
        content: editingNote.content.trim(),
      });
      setEditingNote(null);
      toast({
        title: "Nota actualizada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la nota",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    try {
      await deleteNote.mutateAsync({ prospectId, noteId });
      setDeleteConfirm(null);
      toast({
        title: "Nota eliminada",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la nota",
        variant: "destructive",
      });
    }
  };

  const handleTogglePin = async (noteId: number) => {
    try {
      await togglePin.mutateAsync({ prospectId, noteId });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del pin",
        variant: "destructive",
      });
    }
  };

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  return (
    <div className="flex flex-col h-full">
      {/* New Note Input */}
      <div className="p-4 border-b">
        <div className="flex gap-2">
          <Textarea
            placeholder="Escribe una nota..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="resize-none"
          />
          <Button
            onClick={handleCreateNote}
            disabled={!newNote.trim() || createNote.isPending}
            size="icon"
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No hay notas</p>
              <p className="text-sm">Agrega una nota para comenzar</p>
            </div>
          ) : (
            <>
              {/* Pinned Notes */}
              {pinnedNotes.length > 0 && (
                <div className="space-y-3 mb-4">
                  <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    FIJADAS
                  </p>
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      isEditing={editingNote?.id === note.id}
                      editContent={editingNote?.content || ""}
                      onEditChange={(content) => setEditingNote({ id: note.id, content })}
                      onSaveEdit={handleUpdateNote}
                      onCancelEdit={() => setEditingNote(null)}
                      onStartEdit={() => setEditingNote({ id: note.id, content: note.content })}
                      onTogglePin={() => handleTogglePin(note.id)}
                      onDelete={() => setDeleteConfirm(note.id)}
                    />
                  ))}
                </div>
              )}

              {/* Regular Notes */}
              {unpinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isEditing={editingNote?.id === note.id}
                  editContent={editingNote?.content || ""}
                  onEditChange={(content) => setEditingNote({ id: note.id, content })}
                  onSaveEdit={handleUpdateNote}
                  onCancelEdit={() => setEditingNote(null)}
                  onStartEdit={() => setEditingNote({ id: note.id, content: note.content })}
                  onTogglePin={() => handleTogglePin(note.id)}
                  onDelete={() => setDeleteConfirm(note.id)}
                />
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar nota</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. La nota sera eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDeleteNote(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface NoteCardProps {
  note: any;
  isEditing: boolean;
  editContent: string;
  onEditChange: (content: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onStartEdit: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}

function NoteCard({
  note,
  isEditing,
  editContent,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onTogglePin,
  onDelete,
}: NoteCardProps) {
  return (
    <Card className={note.isPinned ? "border-primary/50 bg-primary/5" : ""}>
      <CardContent className="p-3">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => onEditChange(e.target.value)}
              rows={3}
              className="resize-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancelEdit}>
                Cancelar
              </Button>
              <Button size="sm" onClick={onSaveEdit}>
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onTogglePin}>
                    {note.isPinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Desfijar
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Fijar
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onStartEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {note.createdAt &&
                formatDistance(new Date(note.createdAt), new Date(), {
                  addSuffix: true,
                  locale: es,
                })}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
