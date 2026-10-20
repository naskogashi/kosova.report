// Grouping and publication errors from the community actions, in words staff can act on.
export const issueErrors = {
  merge_ref: "Enter the 10-character reference of the issue to merge into.",
  merge_same: "An issue can't be merged into itself.",
  merge_city: "Issues in different municipalities can't be merged.",
  merge_unavailable: "That issue doesn't exist or was already merged.",
  merge_database: "The merge failed. Nothing was changed.",
  split_alone: "This report is already the only one in its issue.",
  split_unavailable: "That report has no issue to separate from.",
  split_database: "Separating failed. Nothing was changed.",
  summary: "Write a public summary of at least 10 characters before making the issue public.",
  comment: "Write the update before posting it.",
};
