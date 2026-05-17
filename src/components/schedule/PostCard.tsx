import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { User, UniqueString } from "../../models";
import { formatTimeRange } from "../../lib/formatTimeRange";
import { useMultiSelect } from "../../stores/selectionStore";
import { useContextMenu } from "../../stores/contextMenuStore";
import { PositionCardHead } from "./PositionCardHead";
import { WhoCell } from "./WhoCell";

interface PostCardShift {
  si: number;
  from: string;
  to: string;
}

interface PostCardProps {
  postIndex: number;
  post: UniqueString;
  shifts: PostCardShift[];
  assignments: (string | null)[][];
  users: User[];
  selectedUserId: string | null;
  checkedStaffIds: Set<string>;
  customCellDisplayNames: { [slotKey: string]: string };
  isLocked: boolean;
  onPostEdit: (postId: string, newName: string) => void;
  onPostDeleteSingle: (postId: string) => void;
  onCellClick?: (pi: number, si: number, anchor: HTMLSpanElement) => void;
  autoFocusEdit?: boolean;
}

export function PostCard({
  postIndex,
  post,
  shifts,
  assignments,
  users,
  selectedUserId,
  checkedStaffIds,
  customCellDisplayNames,
  isLocked,
  onPostEdit,
  onPostDeleteSingle,
  onCellClick,
  autoFocusEdit,
}: PostCardProps) {
  const { i18n } = useTranslation();
  const dir: "ltr" | "rtl" = i18n.language === "he" ? "rtl" : "ltr";
  const { isMultiChecked } = useMultiSelect();
  const { open: openContextMenu } = useContextMenu();
  const whoRefs = useRef<Map<number, HTMLSpanElement | null>>(new Map());
  const checked = isMultiChecked(post.id, "posts");

  const handleRowContextMenu = (e: React.MouseEvent, si: number) => {
    e.preventDefault();
    openContextMenu({
      kind: "posts",
      targetId: post.id,
      anchorEl: whoRefs.current.get(si) ?? null,
      x: e.clientX,
      y: e.clientY,
      postIndex,
      shiftIndex: si,
    });
  };

  const handleRowKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    si: number
  ) => {
    if (e.shiftKey && e.key === "F10") {
      e.preventDefault();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openContextMenu({
        kind: "posts",
        targetId: post.id,
        anchorEl: whoRefs.current.get(si) ?? null,
        x: rect.left + 8,
        y: rect.bottom,
        postIndex,
        shiftIndex: si,
      });
    }
  };

  return (
    <div
      className={`m-shift-block border rounded-lg transition-shadow flex flex-col h-full bg-background ${
        checked ? "checked" : ""
      }`}
      data-post-id={post.id}
    >
      <div className="shrink-0 rounded-t-lg overflow-hidden">
        <PositionCardHead
          postId={post.id}
          name={post.value}
          onRename={onPostEdit}
          onDeleteSingle={onPostDeleteSingle}
          autoFocusEdit={autoFocusEdit}
          isLocked={isLocked}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-b-lg">
      {shifts.map(({ si, from, to }) => {
        const officialAssignedUserId = assignments[postIndex]?.[si] ?? null;
        const assignedUser = officialAssignedUserId
          ? users.find((u) => u.id === officialAssignedUserId) ?? null
          : null;
        const slotKey = `${postIndex}-${si}`;
        const customDisplayName = customCellDisplayNames[slotKey];
        const isHighlighted =
          officialAssignedUserId !== null &&
          (officialAssignedUserId === selectedUserId ||
            checkedStaffIds.has(officialAssignedUserId));
        return (
          <div
            key={`${post.id}-${si}`}
            data-post-id={post.id}
            className="row grid grid-cols-2 items-center px-3.5 py-2.5 border-t border-border first:border-t-0 bg-background"
            onContextMenu={(e) => handleRowContextMenu(e, si)}
            onKeyDown={(e) => handleRowKeyDown(e, si)}
            tabIndex={-1}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="pos text-xs text-muted-foreground tabular-nums min-w-[90px]">
                {formatTimeRange(from, to, dir)}
              </span>
            </div>
            <WhoCell
              ref={(el) => {
                if (el) whoRefs.current.set(si, el);
                else whoRefs.current.delete(si);
              }}
              pi={postIndex}
              si={si}
              assignedUser={assignedUser}
              customDisplayName={customDisplayName}
              isHighlighted={isHighlighted}
              isLocked={isLocked}
              onClick={(anchor) => onCellClick?.(postIndex, si, anchor)}
            />
          </div>
        );
      })}
      </div>
    </div>
  );
}
