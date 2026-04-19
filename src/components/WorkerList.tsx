import { IconUser, IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { User } from "../models";
import { ActionableText } from "./VerticalActionGroup";
import { colors } from "@/constants/colors";

export interface WorkerListProps {
  users: User[];
  selectedUserId: string | null;
  onSelectUser: (userId: string | null) => void;
  onEditUser: (userId: string | null) => void;
  isEditing: boolean;
  onUpdateUserName: (userId: string, newName: string) => void;
  checkedUserIds: string[];
  onCheckUser: (userId: string, event?: React.MouseEvent) => void;
  onUncheckUser: (userId: string) => void;
  assignments?: (string | null)[][];
}

export function WorkerList({
  users,
  selectedUserId,
  onSelectUser,
  // onEditUser,
  isEditing,
  onUpdateUserName,
  checkedUserIds,
  onCheckUser,
  onUncheckUser,
  assignments,
}: WorkerListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
  }, [users.length, updateScrollState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, [updateScrollState]);

  const handleUserClick = (userId: string) => {
    if (isEditing) return;
    
    console.log("handleUserClick called with userId:", userId);
    console.log("Current selectedUserId:", selectedUserId);
    const newSelectedUserId = selectedUserId === userId ? null : userId;
    console.log("Calling onSelectUser with:", newSelectedUserId);
    onSelectUser(newSelectedUserId);
  };

  // Helper to check if any assignments exist
  const hasAnyAssignments = () => {
    if (!assignments) return false;
    for (const postAssignments of assignments) {
      for (const assignedUserId of postAssignments) {
        if (assignedUserId !== null) {
          return true;
        }
      }
    }
    return false;
  };

  // Helper to count assignments for a user
  const getAssignmentCount = (userId: string) => {
    if (!assignments) return 0;
    let count = 0;
    for (const postAssignments of assignments) {
      for (const assignedUserId of postAssignments) {
        if (assignedUserId === userId) {
          count++;
        }
      }
    }
    return count;
  };



  return (
    <div className="flex flex-col h-full border-primary-rounded-lg overflow-hidden bg-background relative">
      {canScrollUp && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute top-2 start-0 z-10 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconChevronUp size={20} strokeWidth={2.5} />
        </button>
      )}
      {canScrollDown && (
        <button
          onClick={() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })}
          className="absolute bottom-2 start-0 z-10 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconChevronDown size={20} strokeWidth={2.5} />
        </button>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-background ps-2 pe-0 py-2">
        <div className="flex flex-col">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-4 h-full">
              <IconUser className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="font-semibold text-foreground">
                {t("noWorkersAddedYet")}
              </p>
              <p className="font-semibold text-sm text-muted-foreground">
                {t("clickToAddWorker")}
              </p>
            </div>
          ) : (
            users.map((user) => {
              const assignmentCount = getAssignmentCount(user.id);
              return (
                <div
                  key={user.id}
                  data-testid="staff-member"
                  className={`ps-4 pe-0 pb-1 pt-1 gap-1 rounded-md overflow-hidden ${
                    selectedUserId === user.id
                      ? colors.cell.selected
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center w-full min-w-0">
                    {assignments && hasAnyAssignments() && (
                      <div
                        className={`me-2 min-w-[1.5rem] text-center text-xs font-semibold rounded-md px-1 py-0.5 ${
                          selectedUserId === user.id
                            ? "bg-background text-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {assignmentCount}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <ActionableText
                        id={user.id}
                        value={user.name}
                        isSelected={selectedUserId === user.id}
                        isEditing={isEditing}
                        isChecked={checkedUserIds.includes(user.id)}
                        onCheck={(e) => onCheckUser(user.id, e)}
                        onUncheck={() => onUncheckUser(user.id)}
                        onUpdate={onUpdateUserName}
                        onClick={() => handleUserClick(user.id)}
                        allowClickWhenNotEditing={true}
                        className="text-start"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
