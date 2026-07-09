use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepoSnapshot {
    pub(crate) repo: RepoInfo,
    pub(crate) local_branches: Vec<BranchInfo>,
    pub(crate) remotes: Vec<String>,
    pub(crate) tags: Vec<String>,
    pub(crate) stashes: Vec<StashInfo>,
    pub(crate) commits: Vec<CommitInfo>,
    pub(crate) changed_files: Vec<ChangedFile>,
    pub(crate) diff_by_file: serde_json::Map<String, serde_json::Value>,
    pub(crate) conflict_state: ConflictState,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepoInfo {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) current_branch: String,
    pub(crate) upstream: Option<String>,
    pub(crate) has_upstream: bool,
    pub(crate) ahead: usize,
    pub(crate) behind: usize,
    pub(crate) changed: usize,
    pub(crate) conflicts: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BranchInfo {
    pub(crate) name: String,
    pub(crate) meta: String,
    pub(crate) current: bool,
    pub(crate) color: String,
    pub(crate) upstream: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommitInfo {
    pub(crate) id: String,
    pub(crate) subject: String,
    pub(crate) author: String,
    pub(crate) date: String,
    pub(crate) branch: String,
    pub(crate) refs: Vec<String>,
    pub(crate) parents: Vec<String>,
    pub(crate) files: usize,
    pub(crate) insertions: usize,
    pub(crate) deletions: usize,
    pub(crate) lane: String,
    pub(crate) graph: CommitGraphInfo,
    pub(crate) message: String,
    pub(crate) changed_paths: Vec<ChangedFile>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommitGraphInfo {
    pub(crate) node_lane: usize,
    pub(crate) lane_count: usize,
    pub(crate) top_lanes: Vec<usize>,
    pub(crate) bottom_lanes: Vec<usize>,
    pub(crate) parent_lanes: Vec<usize>,
}

impl Default for CommitGraphInfo {
    fn default() -> Self {
        Self {
            node_lane: 0,
            lane_count: 1,
            top_lanes: vec![0],
            bottom_lanes: vec![0],
            parent_lanes: vec![0],
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommitDetailsInfo {
    pub(crate) id: String,
    pub(crate) files: usize,
    pub(crate) insertions: usize,
    pub(crate) deletions: usize,
    pub(crate) message: String,
    pub(crate) changed_paths: Vec<ChangedFile>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CommitDiffInfo {
    pub(crate) id: String,
    pub(crate) short_id: String,
    pub(crate) subject: String,
    pub(crate) author: String,
    pub(crate) author_email: String,
    pub(crate) date: String,
    pub(crate) refs: Vec<String>,
    pub(crate) parents: Vec<String>,
    pub(crate) files: usize,
    pub(crate) insertions: usize,
    pub(crate) deletions: usize,
    pub(crate) message: String,
    pub(crate) selected_file_path: Option<String>,
    pub(crate) changed_paths: Vec<ChangedFile>,
    pub(crate) diff_rows: Vec<serde_json::Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct HistoryCommitInfo {
    pub(crate) id: String,
    pub(crate) short_id: String,
    pub(crate) parents: Vec<String>,
    pub(crate) subject: String,
    pub(crate) author: String,
    pub(crate) date: String,
    pub(crate) refs: Vec<String>,
    pub(crate) files: usize,
    pub(crate) insertions: usize,
    pub(crate) deletions: usize,
    pub(crate) binary_files: usize,
    pub(crate) lines: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileHistoryInfo {
    pub(crate) path: String,
    pub(crate) limit: usize,
    pub(crate) skip: usize,
    pub(crate) best_effort_rename_following: bool,
    pub(crate) entries: Vec<HistoryCommitInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BranchHistoryInfo {
    pub(crate) branch_name: String,
    pub(crate) kind: String,
    pub(crate) current: bool,
    pub(crate) upstream: Option<String>,
    pub(crate) ahead: usize,
    pub(crate) behind: usize,
    pub(crate) limit: usize,
    pub(crate) skip: usize,
    pub(crate) entries: Vec<HistoryCommitInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ChangedFile {
    pub(crate) status: String,
    pub(crate) label: String,
    pub(crate) path: String,
    pub(crate) folder: String,
    pub(crate) section: String,
    pub(crate) tone: String,
    pub(crate) lines: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictState {
    pub(crate) active: bool,
    pub(crate) operation: Option<ConflictOperation>,
    pub(crate) operation_label: String,
    pub(crate) files: Vec<ConflictFile>,
    pub(crate) next_step: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictOperation {
    pub(crate) kind: String,
    pub(crate) label: String,
    pub(crate) git_command: String,
    pub(crate) can_continue: bool,
    pub(crate) can_abort: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictFile {
    pub(crate) path: String,
    pub(crate) status: String,
    pub(crate) kind: String,
    pub(crate) kind_label: String,
    pub(crate) binary: bool,
    pub(crate) has_base: bool,
    pub(crate) has_ours: bool,
    pub(crate) has_theirs: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictFilePreview {
    pub(crate) file: ConflictFile,
    pub(crate) base: ConflictPreviewSide,
    pub(crate) ours: ConflictPreviewSide,
    pub(crate) theirs: ConflictPreviewSide,
    pub(crate) result: ConflictPreviewSide,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConflictPreviewSide {
    pub(crate) label: String,
    pub(crate) available: bool,
    pub(crate) binary: bool,
    pub(crate) truncated: bool,
    pub(crate) lines: Vec<String>,
    pub(crate) message: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StashInfo {
    pub(crate) reference: String,
    pub(crate) short_id: String,
    pub(crate) message: String,
    pub(crate) subject: String,
    pub(crate) branch: String,
    pub(crate) date: String,
    pub(crate) changed_files: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StashDiffInfo {
    pub(crate) stash: StashInfo,
    pub(crate) selected_file_path: Option<String>,
    pub(crate) changed_paths: Vec<ChangedFile>,
    pub(crate) diff_rows: Vec<serde_json::Value>,
    pub(crate) files: usize,
    pub(crate) insertions: usize,
    pub(crate) deletions: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryGroupSnapshot {
    pub(crate) group: RepositoryGroupInfo,
    pub(crate) worktrees: Vec<WorktreeInfo>,
    pub(crate) local_branches: Vec<BranchInfo>,
    pub(crate) remote_branches: Vec<String>,
    pub(crate) remotes: Vec<RemoteInfo>,
    pub(crate) tags: Vec<String>,
    pub(crate) active_worktree: Option<RepoSnapshot>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryGroupInfo {
    pub(crate) name: String,
    pub(crate) root_path: String,
    pub(crate) common_git_dir: String,
    pub(crate) remote_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorktreeInfo {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) branch: Option<String>,
    pub(crate) head: Option<String>,
    pub(crate) dirty_count: usize,
    pub(crate) conflicts: usize,
    pub(crate) locked: bool,
    pub(crate) prunable: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteInfo {
    pub(crate) name: String,
    pub(crate) url: Option<String>,
    pub(crate) push_url: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ClonePreparation {
    pub(crate) root_path: String,
    pub(crate) common_git_dir: String,
    pub(crate) repository_name: String,
    pub(crate) remote_branches: Vec<String>,
    pub(crate) default_branch: Option<String>,
    pub(crate) clone_layout: String,
    pub(crate) meta_branch: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DirectoryEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) is_dir: bool,
    pub(crate) is_git_repo: bool,
    pub(crate) is_hidden: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct AppSettings {
    pub(crate) auto_refresh: bool,
    pub(crate) recent_repo_paths: Vec<String>,
    pub(crate) last_repo_path: String,
    pub(crate) open_repo_paths: Vec<String>,
    pub(crate) active_repo_path: String,
    pub(crate) git_path_mode: String,
    pub(crate) git_executable_path: String,
    pub(crate) prune_deleted_remote_branches: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_refresh: true,
            recent_repo_paths: Vec::new(),
            last_repo_path: String::new(),
            open_repo_paths: Vec::new(),
            active_repo_path: String::new(),
            git_path_mode: "auto".into(),
            git_executable_path: String::new(),
            prune_deleted_remote_branches: true,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitInstallation {
    pub(crate) found: bool,
    pub(crate) path: Option<String>,
    pub(crate) version: Option<String>,
    pub(crate) error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepositoryChangedEvent {
    pub(crate) path: String,
    pub(crate) reason: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitJobStatus {
    pub(crate) id: Option<u64>,
    pub(crate) label: Option<String>,
    pub(crate) running: bool,
    pub(crate) cancel_requested: bool,
}
