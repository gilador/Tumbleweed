import { IconCheck } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useRecoilValue } from "recoil";
import { User } from "../../models";
import { useMultiSelect } from "../../stores/selectionStore";
import { useContextMenu, renameTargetState } from "../../stores/contextMenuStore";
import { WhoCell } from "./WhoCell";

interface TimeViewPostRowProps {
  postId: string;
  postName: string;
  postIndex: number;
  shiftIndex: number;
  assignedUser: User | null;
  customDisplayName?: string;
  isHighlighted: boolean;
  isLocked: boolean;
  onPostRename: (postId: string, newName: string) => void;
  onCellClick?: (pi: number, si: number, anchor: HTMLSpanElement) => void;
  autoFocusEdit?: boolean;
}

export function TimeViewPostRow({
  postId,
  postName,
  postIndex,
  shiftIndex,
  assignedUser,
  customDisplayName,
  isHighlighted,
  isLocked,
  onPostRename,
  onCellClick,
  autoFocusEdit = false,
}: TimeViewPostRowProps) {
  const { inMulti, isMultiChecked, handlePostRowClick } = useMultiSelect();
  const { open: openContextMenu } = useContextMenu();
  const renameTarget = useRecoilValue(renameTargetState);
  const [isEditingLocal, setIsEditingLocal] = useState(autoFocusEdit);
  const [tempValue, setTempValue] = useState(postName);
  const inputRef = useRef<HTMLInputElement>(null);
  const whoRef = useRef<HTMLSpanElement | null>(null);

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
      anchorEl: whoRef.current,
      x: e.clientX,
      y: e.clientY,
      postIndex,
      shiftIndex,
    });
  };

  const handleKeyDownTrigger = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openContextMenu({
        kind: "posts",
        targetId: postId,
        anchorEl: whoRef.current,
        x: rect.left + 8,
        y: rect.bottom,
        postIndex,
        shiftIndex,
      });
    }
  };

  useEffect(() => setTempValue(postName), [postName]);

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
    if (trimmed && trimmed !== postName) onPostRename(postId, trimmed);
    setIsEditingLocal(false);
  };

  const cancel = () => {
    setTempValue(postName);
    setIsEditingLocal(false);
  };

  const handleRowClick = (e: React.MouseEvent) => {
    if (isEditingLocal) return;
    const target = e.target as HTMLElement;
    if (target.closest(".pos-name") || target.closest(".who")) return;
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
      className={`row grid grid-cols-2 items-center px-3.5 py-2.5 border-t border-border first:border-t-0 transition-colors ${
        checked ? "post-checked bg-primary-soft" : "bg-background"
      }`}
      data-post-id={postId}
      onClick={handleRowClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDownTrigger}
      tabIndex={-1}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {inPostsMulti && (
          <span
            aria-hidden
            className={`check-mark inline-grid place-items-center w-4 h-4 rounded border-[1.5px] flex-shrink-0 ${
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
            className="pos-name editing px-2 py-1 text-xs bg-border-strong rounded-md outline-none border-b border-primary min-w-0 flex-1"
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
            className={`pos-name inline-block px-2 py-1 text-xs rounded-md cursor-pointer transition-colors truncate ${
              checked
                ? "checked bg-primary-soft text-primary ring-1 ring-inset ring-primary"
                : "hover:bg-border-strong"
            }`}
            data-pos-id={postId}
            style={{ direction: "ltr", unicodeBidi: "plaintext" }}
            onClick={handleNameClick}
          >
            {postName}
          </span>
        )}
      </div>
      <WhoCell
        ref={whoRef}
        pi={postIndex}
        si={shiftIndex}
        assignedUser={assignedUser}
        customDisplayName={customDisplayName}
        isHighlighted={isHighlighted}
        isLocked={isLocked}
        onClick={(anchor) => onCellClick?.(postIndex, shiftIndex, anchor)}
      />
    </div>
  );
}
