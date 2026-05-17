import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRecoilState } from "recoil";
import { shiftState, getActiveRosterFromState, updateActiveRoster } from "../stores/shiftStore";
import { useMultiSelect } from "../stores/selectionStore";
import { UniqueString } from "../models/index";
import { defaultHours } from "../constants/shiftManagerConstants";
import { trackEvent } from "../lib/analytics";

export function usePostHandlers() {
  const { t } = useTranslation();
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const {
    multiSelected,
    multiSelectKind,
    enterMulti,
    exitMulti,
    toggleInMulti,
  } = useMultiSelect();
  const [newPostName, setNewPostName] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostName, setEditingPostName] = useState("");
  const [justAddedPostId, setJustAddedPostId] = useState<string | null>(null);
  const lastCheckedPostRef = useRef<number | null>(null);

  // Derive legacy checkedPostIds shape from the kind-aware multi-select atom.
  const checkedPostIds: string[] =
    multiSelectKind === "posts" && multiSelected
      ? Array.from(multiSelected)
      : [];

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

    setJustAddedPostId(newPostData.id);
    trackEvent("post-add", {
      totalAfter: (activeRoster.posts?.length || 0) + 1,
    });
    return postName; // Return the post name for toast notification
  };

  const handlePostEdit = (postId: string, newName: string) => {
    const activeRoster = getActiveRosterFromState(recoilState);
    const prevPost = (activeRoster.posts || []).find((p) => p.id === postId);
    if (prevPost && prevPost.value !== newName) {
      trackEvent("post-rename", { from: prevPost.value, to: newName });
    }
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
      const existing =
        multiSelectKind === "posts" && multiSelected
          ? Array.from(multiSelected)
          : [];
      const merged = Array.from(new Set([...existing, ...rangeIds]));
      enterMulti(merged, "posts");
    } else if (multiSelectKind === "posts") {
      // Already in posts multi: add this id (toggle no-ops if already present).
      if (!multiSelected?.has(postId)) toggleInMulti(postId);
    } else {
      enterMulti([postId], "posts");
    }
    lastCheckedPostRef.current = allPostIds.indexOf(postId);
  };

  const handlePostUncheck = (postId: string) => {
    if (multiSelectKind === "posts" && multiSelected?.has(postId)) {
      toggleInMulti(postId);
    }
  };

  const handlePostCheckAll = (allWasClicked: boolean) => {
    const activeRoster = getActiveRosterFromState(recoilState);
    if (allWasClicked) {
      const allPostIds = activeRoster.posts?.map((post) => post.id) || [];
      enterMulti(allPostIds, "posts");
    } else {
      exitMulti();
    }
  };

  const removeSinglePost = (postId: string) => {
    trackEvent("post-delete-single", {});
    setRecoilState((prev) => {
      const activeRosterId = prev.activeRosterId;
      const roster = getActiveRosterFromState(prev);
      const indexToRemove = (roster.posts || []).findIndex((p) => p.id === postId);
      if (indexToRemove === -1) return prev;

      const updatedAssignments = roster.assignments
        ? roster.assignments
            .map((row) => [...row])
            .filter((_, idx) => idx !== indexToRemove)
        : [];

      const updatedUserShiftData = (prev.userShiftData || []).map((userData) => {
        const newConstraints = userData.constraints.filter(
          (_, idx) => idx !== indexToRemove
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
      });

      const updatedPosts = (roster.posts || []).filter((p) => p.id !== postId);

      return {
        ...updateActiveRoster(prev, (r) => ({
          ...r,
          posts: updatedPosts,
          assignments: updatedAssignments,
        })),
        userShiftData: updatedUserShiftData,
      };
    });
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
    exitMulti();
  };

  const consumeJustAddedPostId = () => {
    const id = justAddedPostId;
    if (id !== null) setJustAddedPostId(null);
    return id;
  };

  return {
    newPostName,
    setNewPostName,
    editingPostId,
    setEditingPostId,
    editingPostName,
    setEditingPostName,
    checkedPostIds,
    justAddedPostId,
    consumeJustAddedPostId,
    addPost,
    handlePostEdit,
    savePostEdit,
    handlePostCheck,
    handlePostUncheck,
    handlePostCheckAll,
    handleRemovePosts,
    removeSinglePost,
  };
}
