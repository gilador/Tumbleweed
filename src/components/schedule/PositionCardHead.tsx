import { IconCheck, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useRecoilValue } from "recoil";
import { useTranslation } from "react-i18next";
import { useMultiSelect } from "../../stores/selectionStore";
import { useContextMenu, renameTargetState } from "../../stores/contextMenuStore";

interface PositionCardHeadProps {
  postId: string;
  name: string;
  onRename: (postId: string, newName: string) => void;
  onDeleteSingle: (postId: string) => void;
  autoFocusEdit?: boolean;
  isLocked: boolean;
}

export function PositionCardHead({
  postId,
  name,
  onRename,
  onDeleteSingle,
  autoFocusEdit = false,
  isLocked: _isLocked,
}: PositionCardHeadProps) {
  const { t } = useTranslation();
  const { inMulti, isMultiChecked, handlePostRowClick } = useMultiSelect();
  const { open: openContextMenu } = useContextMenu();
  const renameTarget = useRecoilValue(renameTargetState);
  const [isEditingLocal, setIsEditingLocal] = useState(autoFocusEdit);
  const [tempValue, setTempValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  // External rename trigger (from context menu).
  useEffect(() => {
    if (
      renameTarget &&
      renameTarget.kind === "posts" &&
      renameTarget.id === postId
    ) {
      setIsEditingLocal(true);
    }
  }, [renameTarget, postId]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isEditingLocal) return;
    openContextMenu({
      kind: "posts",
      targetId: postId,
      anchorEl: null,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleKeyDownTrigger = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Shift+F10 — keyboard a11y trigger for context menu.
    if (e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openContextMenu({
        kind: "posts",
        targetId: postId,
        anchorEl: null,
        x: rect.left + 8,
        y: rect.bottom,
      });
    }
  };

  useEffect(() => {
    setTempValue(name);
  }, [name]);

  useEffect(() => {
    if (autoFocusEdit) setIsEditingLocal(true);
  }, [autoFocusEdit]);

  useEffect(() => {
    if (isEditingLocal && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLocal]);

  const inPostsMulti = inMulti("posts");
  const checked = isMultiChecked(postId, "posts");

  const commit = () => {
    const trimmed = tempValue.trim();
    if (trimmed && trimmed !== name) onRename(postId, trimmed);
    setIsEditingLocal(false);
  };

  const cancel = () => {
    setTempValue(name);
    setIsEditingLocal(false);
  };

  const handleHeadClick = (e: React.MouseEvent) => {
    if (isEditingLocal) return;
    // Skip clicks on the name span / trash button (they have their own handlers).
    const target = e.target as HTMLElement;
    if (target.closest(".pos-name") || target.closest(".post-trash")) return;
    handlePostRowClick(postId);
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inPostsMulti) {
      handlePostRowClick(postId);
      return;
    }
    if (!isEditingLocal) setIsEditingLocal(true);
  };

  return (
    <div
      className={`head post-head group flex items-center gap-2.5 px-3.5 py-3 select-none border-b border-border transition-colors ${
        checked ? "bg-muted" : "bg-background hover:bg-border-strong"
      }`}
      data-post-id={postId}
      onClick={handleHeadClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDownTrigger}
      tabIndex={-1}
    >
      {inPostsMulti && (
        <span
          aria-hidden
          className={`check-mark inline-grid place-items-center w-[18px] h-[18px] rounded border-[1.5px] flex-shrink-0 ${
            checked
              ? "bg-primary border-primary text-primary-foreground"
              : "border-border-strong bg-background text-transparent"
          }`}
          data-pos-id={postId}
        >
          <IconCheck size={10} stroke={3} />
        </span>
      )}
      {isEditingLocal ? (
        <input
          ref={inputRef}
          className="pos-name editing flex-1 min-w-0 px-2 py-0.5 text-sm font-semibold bg-transparent outline-none"
          data-pos-id={postId}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="pos-name text-sm font-semibold px-2 py-0.5 rounded-md cursor-pointer transition-colors truncate max-w-[45%]"
          data-pos-id={postId}
          style={{ direction: "ltr", unicodeBidi: "plaintext" }}
          onClick={handleNameClick}
        >
          {name}
        </span>
      )}
      <span className="pos-name-spacer flex-1 min-w-[24px]" />
      {!inPostsMulti && (
        <button
          type="button"
          className="post-trash opacity-0 group-hover:opacity-100 grid place-items-center w-7 h-7 rounded-md text-muted-foreground transition-all hover:bg-destructive hover:text-white flex-shrink-0"
          data-pos-trash={postId}
          aria-label={t("deletePostConfirmSingle")}
          title={t("deletePostConfirmSingle")}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSingle(postId);
          }}
        >
          <IconTrash size={14} />
        </button>
      )}
    </div>
  );
}
