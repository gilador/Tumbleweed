import { useTranslation } from "react-i18next";
import { User, UniqueString } from "../../models";
import { formatTimeRange } from "../../lib/formatTimeRange";
import { TimeViewPostRow } from "./TimeViewPostRow";

interface ShiftCardProps {
  shiftIndex: number;
  startTime: string;
  endTime: string;
  duration?: string;
  posts: UniqueString[];
  assignments: (string | null)[][];
  users: User[];
  selectedUserId: string | null;
  checkedStaffIds: Set<string>;
  customCellDisplayNames: { [slotKey: string]: string };
  isLocked: boolean;
  onPostEdit: (postId: string, newName: string) => void;
  onCellClick?: (pi: number, si: number, anchor: HTMLSpanElement) => void;
  autoFocusPostId?: string | null;
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

export function ShiftCard({
  shiftIndex,
  startTime,
  endTime,
  duration,
  posts,
  assignments,
  users,
  selectedUserId,
  checkedStaffIds,
  customCellDisplayNames,
  isLocked,
  onPostEdit,
  onCellClick,
  autoFocusPostId,
}: ShiftCardProps) {
  const { i18n } = useTranslation();
  const dir: "ltr" | "rtl" = i18n.language === "he" ? "rtl" : "ltr";
  return (
    <div className={`m-shift-block border rounded-lg flex flex-col h-full bg-background`}>
    <div className="head shrink-0 flex items-center gap-2.5 px-3.5 py-3 bg-background border-b border-border rounded-t-lg text-xs font-semibold">
        <span className="ic text-muted-foreground inline-flex">
          <ClockIcon />
        </span>
        <span className="range">
          {formatTimeRange(startTime, endTime, dir)}
        </span>
        {duration && (
          <span className="ms-auto text-[11px] font-medium text-muted-foreground">
            {duration}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto rounded-b-lg">
        {posts.map((post, postIndex) => {
          const officialAssignedUserId =
            assignments[postIndex]?.[shiftIndex] ?? null;
          const assignedUser = officialAssignedUserId
            ? users.find((u) => u.id === officialAssignedUserId) ?? null
            : null;
          const slotKey = `${postIndex}-${shiftIndex}`;
          const customDisplayName = customCellDisplayNames[slotKey];
          const isHighlighted =
            officialAssignedUserId !== null &&
            (officialAssignedUserId === selectedUserId ||
              checkedStaffIds.has(officialAssignedUserId));
          return (
            <TimeViewPostRow
              key={post.id}
              postId={post.id}
              postName={post.value}
              postIndex={postIndex}
              shiftIndex={shiftIndex}
              assignedUser={assignedUser}
              customDisplayName={customDisplayName}
              isHighlighted={isHighlighted}
              isLocked={isLocked}
              onPostRename={onPostEdit}
              onCellClick={onCellClick}
              autoFocusEdit={autoFocusPostId === post.id}
            />
          );
        })}
      </div>
    </div>
  );
}
