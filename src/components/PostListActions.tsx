import {
  IconPlus,
  IconTrash,
  IconSelectAll,
  IconDeselect,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/elements/dialog";
import { Button } from "@/components/elements/button";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface PostListActionsProps {
  isEditing: boolean;
  onAddPost: () => void;
  onRemovePosts: (postIds: string[]) => void;
  checkedPostIds: string[];
  onCheckAll: (allWasClicked: boolean) => void;
}

export function PostListActions({
  isEditing,
  onAddPost,
  onRemovePosts,
  checkedPostIds,
  onCheckAll,
}: PostListActionsProps) {
  const { t } = useTranslation();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [checkAllEnabled, setCheckAllEnabled] = useState(false);

  const handleDelete = () => {
    if (checkedPostIds.length === 0) {
      return; // No posts selected
    }
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    onRemovePosts(checkedPostIds);
    setIsDeleteDialogOpen(false);
    setCheckAllEnabled(false);
  };

  const handleCheckAll = () => {
    setCheckAllEnabled((prev) => {
      const newValue = !prev;
      onCheckAll(newValue);
      return newValue;
    });
  };

  return (
    <div className="flex flex-initial gap-2 mx-1">
      <div
        className={`flex gap-1 items-center bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 transition-all duration-200 ease-in-out ${
          isEditing ? "translate-y-0 opacity-100" : "-translate-y-12 opacity-0 pointer-events-none"
        }`}
      >
      <button
        onClick={onAddPost}
        aria-label={t("addPost")}
        title={t("addPost")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        <IconPlus size={15} />
      </button>
      <button
        onClick={handleDelete}
        aria-label={t("deleteSelectedPosts")}
        title={t("deleteSelectedPosts")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        <IconTrash size={15} />
      </button>
      <button
        onClick={handleCheckAll}
        aria-label={t("selectAllPosts")}
        title={t("selectAllPosts")}
        className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
      >
        {checkAllEnabled ? (
          <IconDeselect size={15} strokeWidth={2} />
        ) : (
          <IconSelectAll size={15} strokeWidth={2} />
        )}
      </button>
      </div>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("deletePostsConfirm", { count: checkedPostIds.length })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <p className="text-muted-foreground">
              {t("onceDeletedNoUndo")}
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteDialogOpen(false)}
              >
                {t("no")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                {t("yesPlease")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
