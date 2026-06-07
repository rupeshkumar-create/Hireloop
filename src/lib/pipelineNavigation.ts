/** React Router location state when navigating to Pipeline after saving a match. */
export type PipelineNavigationState = {
  highlightJobId?: string;
  fromSave?: boolean;
  savedTitle?: string;
  savedCompany?: string;
};
