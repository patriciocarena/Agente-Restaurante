import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  onConfirm: () => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  itemCount,
  onConfirm,
}: DeleteCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Borrar categoría</DialogTitle>
          <DialogDescription>
            {itemCount === 0
              ? 'Esta categoría no tiene items. ¿La borrás?'
              : `Esta categoría tiene ${itemCount} items. Si la borrás, también se borran. ¿Continuar?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            {itemCount === 0 ? 'Borrar' : 'Borrar todo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
