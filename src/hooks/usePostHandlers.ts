import { useState } from "react";
import { useRecoilState } from "recoil";
import { shiftState } from "../stores/shiftStore";
import { UniqueString } from "../models/index";
import { defaultHours } from "../constants/shiftManagerConstants";

export function usePostHandlers() {
  const [recoilState, setRecoilState] = useRecoilState(shiftState);
  const [newPostName, setNewPostName] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostName, setEditingPostName] = useState("");
  const [checkedPostIds, setCheckedPostIds] = useState<string[]>([]);

  const addPost = () => {
    const postName =
      newPostName.trim() || `New Post ${(recoilState.posts?.length || 0) + 1}`;

    const newPostData: UniqueString = {
      id: `post-${Date.now()}`,
      value: postName,
    };

    setNewPostName("");

    // Update assignments and posts in Recoil state
    setRecoilState((prev) => {
      const newAssignments = prev.assignments ? [...prev.assignments] : [];
      newAssignments.push((prev.hours || defaultHours).map(() => null)); // Add a new row for the new post

      const updatedUserShiftData = (prev.userShiftData || []).map(
        (userData) => {
          const newConstraints = [...userData.constraints];
          newConstraints.push(
            (prev.hours || defaultHours).map((hour) => ({
              postID: newPostData.id,
              hourID: hour.id,
              availability: true,
            }))
          );
          return { ...userData, constraints: newConstraints };
        }
      );

      return {
        ...prev,
        posts: [newPostData, ...(prev.posts || [])],
        assignments: newAssignments,
        userShiftData: updatedUserShiftData,
        manuallyEditedSlots: prev.manuallyEditedSlots || {},
        customCellDisplayNames: prev.customCellDisplayNames || {},
      };
    });

    return postName; // Return the post name for toast notification
  };

  const handlePostEdit = (postId: string, newName: string) => {
    // Update assignments and posts in Recoil state
    setRecoilState((prev) => ({
      ...prev,
      posts: (prev.posts || []).map((post) =>
        post.id === postId ? { ...post, value: newName } : post
      ),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
  };

  const savePostEdit = () => {
    if (!editingPostId || !editingPostName.trim()) return;

    // Update assignments and posts in Recoil state
    setRecoilState((prev) => ({
      ...prev,
      posts: (prev.posts || []).map((post) =>
        post.id === editingPostId
          ? { ...post, value: editingPostName.trim() }
          : post
      ),
      manuallyEditedSlots: prev.manuallyEditedSlots || {},
      customCellDisplayNames: prev.customCellDisplayNames || {},
    }));
    setEditingPostId(null);
    setEditingPostName("");
  };

  const handlePostCheck = (postId: string) => {
    setCheckedPostIds([...checkedPostIds, postId]);
  };

  const handlePostUncheck = (postId: string) => {
    setCheckedPostIds((ids) => ids.filter((id) => id !== postId));
  };

  const handlePostCheckAll = (allWasClicked: boolean) => {
    if (allWasClicked) {
      setCheckedPostIds(recoilState.posts?.map((post) => post.id) || []);
    } else {
      setCheckedPostIds([]);
    }
  };

  const handleRemovePosts = (postIdsToRemove: string[]) => {
    setRecoilState((prev) => {
      const indicesToRemove = (prev.posts || [])
        .map((p, index) => (postIdsToRemove.includes(p.id) ? index : -1))
        .filter((index) => index !== -1)
        .sort((a, b) => b - a); // Sort descending to splice correctly

      if (indicesToRemove.length === 0) {
        return prev; // No posts found to remove
      }

      let updatedAssignments = prev.assignments
        ? prev.assignments.map((row) => [...row])
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
          return { ...userData, constraints: newConstraints };
        }
      );

      const updatedPosts = (prev.posts || []).filter(
        (post) => !postIdsToRemove.includes(post.id)
      );

      return {
        ...prev,
        posts: updatedPosts,
        assignments: updatedAssignments,
        userShiftData: updatedUserShiftData,
        manuallyEditedSlots: prev.manuallyEditedSlots || {},
        customCellDisplayNames: prev.customCellDisplayNames || {},
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
