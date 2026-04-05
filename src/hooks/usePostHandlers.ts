import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "../stores/shiftStore";
import { UniqueString } from "../models/index";
import { defaultHours } from "../constants/shiftManagerConstants";

export function usePostHandlers() {
  const { t } = useTranslation();
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const [newPostName, setNewPostName] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostName, setEditingPostName] = useState("");
  const [checkedPostIds, setCheckedPostIds] = useState<string[]>([]);
  const lastCheckedPostRef = useRef<number | null>(null);

  const addPost = () => {
    const activeRoster = getActiveRosterFromState(recoilState);
    const postName =
      newPostName.trim() || t("defaultPost", { n: (activeRoster.posts?.length || 0) + 1 });

    const newPostData: UniqueString = {
      id: `post-${Date.now()}`,
      value: postName,
    };

    setNewPostName("");

    // Update assignments and posts in Recoil state
    setRecoilState((prev) => {
      const activeRosterId = prev.activeRosterId;
      const roster = getActiveRosterFromState(prev);
      const rosterHours = roster.hours || defaultHours;

      const newAssignments = roster.assignments ? [...roster.assignments] : [];
      newAssignments.push(rosterHours.map(() => null)); // Add a new row for the new post

      const updatedUserShiftData = (prev.userShiftData || []).map(
        (userData) => {
          const newConstraints = [...userData.constraints];
          newConstraints.push(
            rosterHours.map((hour) => ({
              postID: newPostData.id,
              hourID: hour.id,
              availability: true,
            }))
          );

          // Also update constraintsByRoster for the active roster
          const updatedConstraintsByRoster = {
            ...userData.constraintsByRoster,
            [activeRosterId]: newConstraints,
          };

          return {
            ...userData,
            constraints: newConstraints,
            constraintsByRoster: updatedConstraintsByRoster,
          };
        }
      );

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          posts: [newPostData, ...(r.posts || [])],
          assignments: newAssignments,
        })),
        userShiftData: updatedUserShiftData,
      };
    });

    return postName; // Return the post name for toast notification
  };

  const handlePostEdit = (postId: string, newName: string) => {
    setRecoilState((prev) =>
      updateActiveRoster(prev, (r) => ({
        ...r,
        posts: (r.posts || []).map((post) =>
          post.id === postId ? { ...post, value: newName } : post
        ),
      }))
    );
  };

  const savePostEdit = () => {
    if (!editingPostId || !editingPostName.trim()) return;

    setRecoilState((prev) =>
      updateActiveRoster(prev, (r) => ({
        ...r,
        posts: (r.posts || []).map((post) =>
          post.id === editingPostId
            ? { ...post, value: editingPostName.trim() }
            : post
        ),
      }))
    );
    setEditingPostId(null);
    setEditingPostName("");
  };

  const handlePostCheck = (postId: string, event?: React.MouseEvent) => {
    const activeRoster = getActiveRosterFromState(recoilState);
    const allPostIds = activeRoster.posts?.map((p) => p.id) || [];

    if (event?.shiftKey && lastCheckedPostRef.current !== null) {
      const currentIndex = allPostIds.indexOf(postId);
      const start = Math.min(lastCheckedPostRef.current, currentIndex);
      const end = Math.max(lastCheckedPostRef.current, currentIndex);
      const rangeIds = allPostIds.slice(start, end + 1);
      setCheckedPostIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setCheckedPostIds((prev) => [...prev, postId]);
    }
    lastCheckedPostRef.current = allPostIds.indexOf(postId);
  };

  const handlePostUncheck = (postId: string) => {
    setCheckedPostIds((ids) => ids.filter((id) => id !== postId));
  };

  const handlePostCheckAll = (allWasClicked: boolean) => {
    const activeRoster = getActiveRosterFromState(recoilState);
    if (allWasClicked) {
      setCheckedPostIds(activeRoster.posts?.map((post) => post.id) || []);
    } else {
      setCheckedPostIds([]);
    }
  };

  const handleRemovePosts = (postIdsToRemove: string[]) => {
    setRecoilState((prev) => {
      const activeRosterId = prev.activeRosterId;
      const roster = getActiveRosterFromState(prev);

      const indicesToRemove = (roster.posts || [])
        .map((p, index) => (postIdsToRemove.includes(p.id) ? index : -1))
        .filter((index) => index !== -1)
        .sort((a, b) => b - a); // Sort descending to splice correctly

      if (indicesToRemove.length === 0) {
        return prev; // No posts found to remove
      }

      let updatedAssignments = roster.assignments
        ? roster.assignments.map((row) => [...row])
        : [];
      indicesToRemove.forEach((index) => {
        if (index < updatedAssignments.length) {
          updatedAssignments.splice(index, 1);
        }
      });

      const updatedUserShiftData = (prev.userShiftData || []).map(
        (userData) => {
          const newConstraints = userData.constraints.filter(
            (_, index) => !indicesToRemove.includes(index)
          );

          const updatedConstraintsByRoster = {
            ...userData.constraintsByRoster,
            [activeRosterId]: newConstraints,
          };

          return {
            ...userData,
            constraints: newConstraints,
            constraintsByRoster: updatedConstraintsByRoster,
          };
        }
      );

      const updatedPosts = (roster.posts || []).filter(
        (post) => !postIdsToRemove.includes(post.id)
      );

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          posts: updatedPosts,
          assignments: updatedAssignments,
        })),
        userShiftData: updatedUserShiftData,
      };
    });
    setCheckedPostIds([]);
  };

  return {
    newPostName,
    setNewPostName,
    editingPostId,
    setEditingPostId,
    editingPostName,
    setEditingPostName,
    checkedPostIds,
    addPost,
    handlePostEdit,
    savePostEdit,
    handlePostCheck,
    handlePostUncheck,
    handlePostCheckAll,
    handleRemovePosts,
  };
}
