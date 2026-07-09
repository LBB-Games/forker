use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    process::Command,
};

use crate::{
    changes::changed_files,
    conflicts::conflict_state,
    git_process::{git_executable, git_in_bare_repo, git_in_worktree, lines},
    models::{
        BranchInfo, ClonePreparation, RemoteInfo, RepoSnapshot, RepositoryGroupInfo,
        RepositoryGroupSnapshot, WorktreeInfo,
    },
    snapshot::snapshot,
};

const HIDDEN_UI_BRANCHES: &[&str] = &["repo.meta", "repo-meta"];
const PREFERRED_META_BRANCH: &str = "repo.meta";
const META_BRANCH_CANDIDATES: &[&str] = &["repo.meta", "repo-meta"];

#[derive(Debug, Clone)]
enum RepositoryGroupLayout {
    BareContainer,
    MetaCheckout {
        meta_worktree_path: PathBuf,
        worktrees_dir: PathBuf,
        meta_branch: Option<String>,
    },
}

#[derive(Debug, Clone)]
struct RepositoryGroupContext {
    root: PathBuf,
    common_git_dir: PathBuf,
    layout: RepositoryGroupLayout,
}

impl RepositoryGroupContext {
    fn is_meta_worktree(&self, path: &str) -> bool {
        match &self.layout {
            RepositoryGroupLayout::MetaCheckout {
                meta_worktree_path, ..
            } => same_path(path, &meta_worktree_path.to_string_lossy()),
            RepositoryGroupLayout::BareContainer => false,
        }
    }

    fn worktree_parent(&self) -> PathBuf {
        match &self.layout {
            RepositoryGroupLayout::BareContainer => self.root.clone(),
            RepositoryGroupLayout::MetaCheckout { worktrees_dir, .. } => worktrees_dir.clone(),
        }
    }

    fn hidden_meta_branch(&self) -> Option<&str> {
        match &self.layout {
            RepositoryGroupLayout::MetaCheckout { meta_branch, .. } => meta_branch.as_deref(),
            RepositoryGroupLayout::BareContainer => None,
        }
    }
}

#[derive(Debug, Default)]
struct ParsedWorktree {
    path: String,
    head: Option<String>,
    branch: Option<String>,
    bare: bool,
    detached: bool,
    locked: bool,
    prunable: bool,
}

pub(crate) fn open_group_snapshot(
    root_path: &str,
    active_worktree_path: Option<&str>,
) -> Result<RepositoryGroupSnapshot, String> {
    let requested_root = expand_home_path(root_path.trim());
    let mut root = requested_root.clone();
    let mut requested_child_worktree = None;
    if validate_group_root(&root).is_err() && root.join(".git").is_file() {
        if let Some(group_root) = group_root_for_child_worktree(&root)? {
            requested_child_worktree = Some(root.to_string_lossy().to_string());
            root = group_root;
        }
    }
    let ctx = resolve_group_context(&root)?;
    root = ctx.root.clone();
    let common_git_dir = ctx.common_git_dir.clone();
    let worktrees = list_worktrees_for_context(&ctx)?;

    let active_path = active_worktree_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| expand_home_path(value).to_string_lossy().to_string())
        .or(requested_child_worktree)
        .filter(|path| !ctx.is_meta_worktree(path))
        .or_else(|| worktrees.first().map(|worktree| worktree.path.clone()));

    let active_worktree = match active_path {
        Some(path)
            if worktrees
                .iter()
                .any(|worktree| same_path(&worktree.path, &path)) =>
        {
            Some(snapshot(&path)?)
        }
        Some(path) => {
            return Err(format!(
                "Selected worktree is not registered in this repository group: {path}"
            ));
        }
        None => None,
    };

    let local_branches = local_branches_for_group(
        &ctx,
        active_worktree
            .as_ref()
            .map(|s| s.repo.current_branch.as_str()),
    )?;
    let remote_branches = remote_branches_for_group(&ctx);
    let remotes = remotes_for_group(&ctx);
    let tags = lines(git_in_group(&ctx, &["tag", "--sort=-creatordate"]).unwrap_or_default())
        .into_iter()
        .take(24)
        .collect();
    let remote_url = remotes
        .iter()
        .find(|remote| remote.name == "origin")
        .or_else(|| remotes.first())
        .and_then(|remote| remote.url.clone());
    let name = root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Repository")
        .to_string();

    Ok(RepositoryGroupSnapshot {
        group: RepositoryGroupInfo {
            name,
            root_path: root.to_string_lossy().to_string(),
            common_git_dir: common_git_dir.to_string_lossy().to_string(),
            remote_url,
        },
        worktrees,
        local_branches,
        remote_branches,
        remotes,
        tags,
        active_worktree,
    })
}

pub(crate) fn clone_standard_repository_impl(
    remote_url: &str,
    parent_path: &str,
    directory_name: Option<&str>,
) -> Result<RepoSnapshot, String> {
    let remote_url = remote_url.trim();
    if remote_url.is_empty() {
        return Err("Remote URL is required.".into());
    }
    let parent = expand_home_path(parent_path.trim());
    if parent.as_os_str().is_empty() {
        return Err("Choose a default clone location first.".into());
    }
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Unable to create clone location {}: {e}", parent.display()))?;
    if !parent.is_dir() {
        return Err(format!(
            "Clone location is not a folder: {}",
            parent.display()
        ));
    }

    let directory = directory_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| repository_name_from_url(remote_url));
    validate_child_name(&directory, "Repository folder name")?;
    let root = parent.join(&directory);
    if root.exists()
        && root
            .read_dir()
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(true)
    {
        return Err(format!(
            "Destination already exists and is not empty: {}",
            root.display()
        ));
    }

    let executable = git_executable();
    let output = Command::new(&executable)
        .arg("clone")
        .arg(remote_url)
        .arg(&root)
        .output()
        .map_err(|e| format!("Failed to run {executable} clone: {e}"))?;
    if !output.status.success() {
        let _ = std::fs::remove_dir_all(&root);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Git clone failed".into()
        } else {
            stderr
        });
    }
    snapshot(&root.to_string_lossy())
}

pub(crate) fn prepare_bare_clone_impl(
    remote_url: &str,
    parent_path: &str,
    directory_name: Option<&str>,
) -> Result<ClonePreparation, String> {
    let remote_url = remote_url.trim();
    if remote_url.is_empty() {
        return Err("Remote URL is required.".into());
    }
    let parent = expand_home_path(parent_path.trim());
    if parent.as_os_str().is_empty() {
        return Err("Choose a default clone location first.".into());
    }
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Unable to create clone location {}: {e}", parent.display()))?;
    if !parent.is_dir() {
        return Err(format!(
            "Clone location is not a folder: {}",
            parent.display()
        ));
    }

    let directory = directory_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| repository_name_from_url(remote_url));
    validate_child_name(&directory, "Repository folder name")?;

    let root = parent.join(&directory);
    if root.exists()
        && root
            .read_dir()
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(true)
    {
        return Err(format!(
            "Destination already exists and is not empty: {}",
            root.display()
        ));
    }
    std::fs::create_dir_all(&root)
        .map_err(|e| format!("Unable to create destination {}: {e}", root.display()))?;
    let common_git_dir = root.join(".git");
    if common_git_dir.exists() {
        return Err(format!(
            "Bare Git directory already exists: {}",
            common_git_dir.display()
        ));
    }

    let executable = git_executable();
    let output = Command::new(&executable)
        .arg("clone")
        .arg("--bare")
        .arg(remote_url)
        .arg(&common_git_dir)
        .output()
        .map_err(|e| format!("Failed to run {executable} clone: {e}"))?;
    if !output.status.success() {
        let _ = std::fs::remove_dir_all(&root);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Git clone failed".into()
        } else {
            stderr
        });
    }

    let git_dir = common_git_dir.to_string_lossy();
    git_in_bare_repo(
        &git_dir,
        &[
            "config",
            "remote.origin.fetch",
            "+refs/heads/*:refs/remotes/origin/*",
        ],
    )?;
    git_in_bare_repo(&git_dir, &["config", "core.bare", "true"])?;
    git_in_bare_repo(&git_dir, &["fetch", "origin", "--prune"])?;

    Ok(ClonePreparation {
        root_path: root.to_string_lossy().to_string(),
        common_git_dir: common_git_dir.to_string_lossy().to_string(),
        repository_name: directory,
        remote_branches: remote_branches_for_common_git_dir(&common_git_dir),
        default_branch: default_branch_for_common_git_dir(&common_git_dir),
        clone_layout: "bare".into(),
        meta_branch: None,
    })
}

pub(crate) fn prepare_meta_clone_impl(
    remote_url: &str,
    parent_path: &str,
    directory_name: Option<&str>,
) -> Result<ClonePreparation, String> {
    let remote_url = remote_url.trim();
    if remote_url.is_empty() {
        return Err("Remote URL is required.".into());
    }
    let parent = expand_home_path(parent_path.trim());
    if parent.as_os_str().is_empty() {
        return Err("Choose a default clone location first.".into());
    }
    std::fs::create_dir_all(&parent)
        .map_err(|e| format!("Unable to create clone location {}: {e}", parent.display()))?;
    if !parent.is_dir() {
        return Err(format!(
            "Clone location is not a folder: {}",
            parent.display()
        ));
    }

    let directory = directory_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| repository_name_from_url(remote_url));
    validate_child_name(&directory, "Repository folder name")?;

    let root = parent.join(&directory);
    if root.exists()
        && root
            .read_dir()
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(true)
    {
        return Err(format!(
            "Destination already exists and is not empty: {}",
            root.display()
        ));
    }

    let executable = git_executable();
    let existing_meta_branch = remote_meta_branch(remote_url)?;
    let output = Command::new(&executable)
        .arg("clone")
        .arg(remote_url)
        .arg(&root)
        .output()
        .map_err(|e| format!("Failed to run {executable} clone: {e}"))?;
    if !output.status.success() {
        let _ = std::fs::remove_dir_all(&root);
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Git clone failed".into()
        } else {
            stderr
        });
    }

    if let Some(meta_branch) = existing_meta_branch.as_deref() {
        git_in_worktree(&root.to_string_lossy(), &["checkout", meta_branch])?;
    } else {
        git_in_worktree(
            &root.to_string_lossy(),
            &["checkout", "--orphan", PREFERRED_META_BRANCH],
        )?;
        git_in_worktree(&root.to_string_lossy(), &["rm", "-rf", "."]).ok();
        std::fs::create_dir_all(root.join("worktrees"))
            .map_err(|e| format!("Unable to create worktrees folder: {e}"))?;
        std::fs::write(root.join(".gitignore"), "worktrees/\n")
            .map_err(|e| format!("Unable to write .gitignore: {e}"))?;
        git_in_worktree(&root.to_string_lossy(), &["add", ".gitignore"])?;
        git_in_worktree(
            &root.to_string_lossy(),
            &[
                "-c",
                "user.name=Forker",
                "-c",
                "user.email=forker@local",
                "commit",
                "-m",
                "Initialize repo metadata",
            ],
        )?;
    }
    git_in_worktree(&root.to_string_lossy(), &["fetch", "origin", "--prune"])?;

    let common_git_dir = common_git_dir_for_worktree(&root)?;
    Ok(ClonePreparation {
        root_path: root.to_string_lossy().to_string(),
        common_git_dir: common_git_dir.to_string_lossy().to_string(),
        repository_name: directory,
        remote_branches: remote_branches_for_common_git_dir(&common_git_dir),
        default_branch: default_branch_for_common_git_dir(&common_git_dir),
        clone_layout: "meta".into(),
        meta_branch: existing_meta_branch.or_else(|| Some(PREFERRED_META_BRANCH.into())),
    })
}

pub(crate) fn complete_first_worktree_impl(
    root_path: &str,
    selected_remote_branch: &str,
    local_branch_name: Option<&str>,
    worktree_name: Option<&str>,
) -> Result<RepositoryGroupSnapshot, String> {
    let remote_branch = normalize_remote_branch(selected_remote_branch)?;
    let local_branch = local_branch_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| remote_branch.clone());
    validate_branch_name(&local_branch)?;
    let worktree_name = worktree_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| safe_worktree_name(&local_branch));
    create_worktree_impl(
        root_path,
        &local_branch,
        &worktree_name,
        Some(&format!("origin/{remote_branch}")),
    )
}

pub(crate) fn create_worktree_impl(
    root_path: &str,
    branch_name: &str,
    worktree_name: &str,
    start_point: Option<&str>,
) -> Result<RepositoryGroupSnapshot, String> {
    let root = expand_home_path(root_path.trim());
    let ctx = resolve_group_context(&root)?;
    validate_child_name(worktree_name.trim(), "Worktree folder name")?;
    validate_branch_name(branch_name.trim())?;
    let worktree_parent = ctx.worktree_parent();
    std::fs::create_dir_all(&worktree_parent).map_err(|e| {
        format!(
            "Unable to create worktree folder {}: {e}",
            worktree_parent.display()
        )
    })?;
    let worktree_path = worktree_parent.join(worktree_name.trim());
    if worktree_path == ctx.root {
        return Err("Worktree path cannot be the repository container.".into());
    }
    if worktree_path.exists() {
        return Err(format!(
            "Worktree destination already exists: {}",
            worktree_path.display()
        ));
    }

    let worktree_path_string = worktree_path.to_string_lossy().to_string();
    let branch_exists = git_in_group(
        &ctx,
        &[
            "show-ref",
            "--verify",
            "--quiet",
            &format!("refs/heads/{}", branch_name.trim()),
        ],
    )
    .is_ok();

    if branch_exists {
        git_in_group(
            &ctx,
            &["worktree", "add", &worktree_path_string, branch_name.trim()],
        )?;
    } else {
        let start_point = start_point
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                "Choose a remote branch or start point for the new worktree.".to_string()
            })?;
        git_in_group(
            &ctx,
            &[
                "worktree",
                "add",
                "-b",
                branch_name.trim(),
                &worktree_path_string,
                start_point,
            ],
        )?;
    }

    open_group_snapshot(&ctx.root.to_string_lossy(), Some(&worktree_path_string))
}

pub(crate) fn remove_worktree_impl(
    root_path: &str,
    worktree_path: &str,
    force: bool,
) -> Result<RepositoryGroupSnapshot, String> {
    let root = expand_home_path(root_path.trim());
    let ctx = resolve_group_context(&root)?;
    let worktree = expand_home_path(worktree_path.trim());
    if same_path(&ctx.root.to_string_lossy(), &worktree.to_string_lossy())
        || ctx.is_meta_worktree(&worktree.to_string_lossy())
    {
        return Err("Refusing to remove the repository container.".into());
    }
    if !worktree.starts_with(&ctx.root) {
        return Err("Refusing to remove a worktree outside the repository container.".into());
    }
    let registered = list_worktrees_for_context(&ctx)?
        .into_iter()
        .any(|item| same_path(&item.path, &worktree.to_string_lossy()));
    if !registered {
        return Err("Selected folder is not a registered worktree.".into());
    }
    if !force {
        let dirty = dirty_counts(&worktree.to_string_lossy()).0;
        if dirty > 0 {
            return Err(format!(
                "Worktree has {dirty} changed file(s). Remove again with force to discard it."
            ));
        }
    }
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    let worktree_string = worktree.to_string_lossy().to_string();
    args.push(&worktree_string);
    git_in_group(&ctx, &args)?;
    open_group_snapshot(&ctx.root.to_string_lossy(), None)
}

pub(crate) fn prune_worktrees_impl(root_path: &str) -> Result<RepositoryGroupSnapshot, String> {
    let root = expand_home_path(root_path.trim());
    let ctx = resolve_group_context(&root)?;
    git_in_group(&ctx, &["worktree", "prune"])?;
    open_group_snapshot(&ctx.root.to_string_lossy(), None)
}

fn list_worktrees_for_context(ctx: &RepositoryGroupContext) -> Result<Vec<WorktreeInfo>, String> {
    let output = git_in_group(ctx, &["worktree", "list", "--porcelain"])?;
    let parsed = parse_worktree_porcelain(&output);
    Ok(parsed
        .into_iter()
        .filter(|entry| !entry.bare)
        .filter(|entry| !same_path(&entry.path, &ctx.common_git_dir.to_string_lossy()))
        .filter(|entry| !ctx.is_meta_worktree(&entry.path))
        .filter(|entry| !entry.branch.as_deref().is_some_and(is_hidden_branch_name))
        .filter(|entry| match &ctx.layout {
            RepositoryGroupLayout::MetaCheckout { worktrees_dir, .. } => {
                Path::new(&entry.path).starts_with(worktrees_dir)
            }
            RepositoryGroupLayout::BareContainer => true,
        })
        .map(|entry| {
            let (dirty_count, conflicts) = dirty_counts(&entry.path);
            let name = Path::new(&entry.path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(&entry.path)
                .to_string();
            WorktreeInfo {
                id: entry.path.clone(),
                name,
                path: entry.path,
                branch: entry.branch.filter(|_| !entry.detached),
                head: entry.head,
                dirty_count,
                conflicts,
                locked: entry.locked,
                prunable: entry.prunable,
            }
        })
        .collect())
}

fn validate_group_root(root: &Path) -> Result<(), String> {
    resolve_group_context(root).map(|_| ())
}

fn resolve_group_context(root: &Path) -> Result<RepositoryGroupContext, String> {
    if !root.exists() {
        return Err(format!(
            "Repository container does not exist: {}",
            root.display()
        ));
    }
    if !root.is_dir() {
        return Err(format!(
            "Repository container is not a folder: {}",
            root.display()
        ));
    }
    let root = std::fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let dot_git = root.join(".git");
    if dot_git.is_file() {
        return Err(
            "Selected a child worktree. Choose the repository container or a worktree under it."
                .into(),
        );
    }
    if !dot_git.is_dir() {
        return Err("Selected folder is not a Forker worktree repository container: missing .git directory.".into());
    }

    if git_in_bare_repo(
        &dot_git.to_string_lossy(),
        &["rev-parse", "--is-bare-repository"],
    )
    .map(|value| value.trim() == "true")
    .unwrap_or(false)
    {
        return Ok(RepositoryGroupContext {
            root,
            common_git_dir: dot_git,
            layout: RepositoryGroupLayout::BareContainer,
        });
    }

    let top_level = git_in_worktree(&root.to_string_lossy(), &["rev-parse", "--show-toplevel"])?;
    let top_level = top_level.trim();
    if top_level.is_empty() || !same_path(top_level, &root.to_string_lossy()) {
        return Err("Selected folder is inside a Git repository. Choose the repository root or a registered worktree.".into());
    }
    let common_git_dir = common_git_dir_for_worktree(&root)?;
    let meta_branch = git_in_worktree(&root.to_string_lossy(), &["branch", "--show-current"])
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let worktrees_dir = root.join("worktrees");

    Ok(RepositoryGroupContext {
        root: root.clone(),
        common_git_dir,
        layout: RepositoryGroupLayout::MetaCheckout {
            meta_worktree_path: root,
            worktrees_dir,
            meta_branch,
        },
    })
}

fn common_git_dir_for_worktree(worktree: &Path) -> Result<PathBuf, String> {
    let output = git_in_worktree(
        &worktree.to_string_lossy(),
        &["rev-parse", "--git-common-dir"],
    )?;
    let value = output.trim();
    if value.is_empty() {
        return Err("Unable to determine repository common Git directory.".into());
    }
    let path = Path::new(value);
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        worktree.join(path)
    };
    Ok(std::fs::canonicalize(&path).unwrap_or(path))
}

fn git_in_group(ctx: &RepositoryGroupContext, args: &[&str]) -> Result<String, String> {
    match &ctx.layout {
        RepositoryGroupLayout::BareContainer => {
            git_in_bare_repo(&ctx.common_git_dir.to_string_lossy(), args)
        }
        RepositoryGroupLayout::MetaCheckout { .. } => {
            git_in_worktree(&ctx.root.to_string_lossy(), args)
        }
    }
}

fn group_root_for_child_worktree(worktree: &Path) -> Result<Option<PathBuf>, String> {
    let dot_git = worktree.join(".git");
    if !dot_git.is_file() {
        return Ok(None);
    }
    let contents = std::fs::read_to_string(&dot_git)
        .map_err(|e| format!("Unable to read {}: {e}", dot_git.display()))?;
    let gitdir = contents
        .lines()
        .find_map(|line| line.trim().strip_prefix("gitdir:").map(str::trim));
    let Some(gitdir) = gitdir else {
        return Ok(None);
    };
    let gitdir_path = if Path::new(gitdir).is_absolute() {
        PathBuf::from(gitdir)
    } else {
        worktree.join(gitdir)
    };
    let gitdir_path = std::fs::canonicalize(&gitdir_path).unwrap_or(gitdir_path);
    for ancestor in gitdir_path.ancestors() {
        if ancestor.file_name().and_then(|value| value.to_str()) == Some(".git") {
            if let Some(root) = ancestor.parent() {
                return Ok(Some(root.to_path_buf()));
            }
        }
    }
    Ok(None)
}

fn parse_worktree_porcelain(output: &str) -> Vec<ParsedWorktree> {
    let mut entries = Vec::new();
    let mut current = ParsedWorktree::default();
    let mut has_current = false;

    for line in output.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            if has_current {
                entries.push(current);
                current = ParsedWorktree::default();
                has_current = false;
            }
            continue;
        }
        if let Some(path) = line.strip_prefix("worktree ") {
            if has_current {
                entries.push(current);
                current = ParsedWorktree::default();
            }
            current.path = path.to_string();
            has_current = true;
        } else if let Some(head) = line.strip_prefix("HEAD ") {
            current.head = Some(head.to_string());
        } else if let Some(branch) = line.strip_prefix("branch ") {
            current.branch = branch
                .strip_prefix("refs/heads/")
                .unwrap_or(branch)
                .to_string()
                .into();
        } else if line == "bare" {
            current.bare = true;
        } else if line == "detached" {
            current.detached = true;
        } else if line.starts_with("locked") {
            current.locked = true;
        } else if line.starts_with("prunable") {
            current.prunable = true;
        }
    }
    if has_current {
        entries.push(current);
    }
    entries
}

fn dirty_counts(worktree_path: &str) -> (usize, usize) {
    let changed = changed_files(worktree_path).unwrap_or_default();
    let conflict_files = conflict_state(worktree_path).files.len();
    (changed.len(), conflict_files)
}

fn local_branches_for_group(
    ctx: &RepositoryGroupContext,
    current_branch: Option<&str>,
) -> Result<Vec<BranchInfo>, String> {
    let output = git_in_group(
        ctx,
        &[
            "for-each-ref",
            "--format=%(refname:short)|%(upstream:trackshort)|%(upstream:short)",
            "refs/heads",
        ],
    )?;
    let open_by_branch = checked_out_branches(ctx);
    let hidden_meta_branch = ctx.hidden_meta_branch();
    let colors = ["blue", "violet", "amber", "green"];
    Ok(output
        .lines()
        .filter_map(|line| {
            let mut fields = line.split('|');
            let name = fields.next()?.trim();
            if name.is_empty() || hidden_meta_branch == Some(name) || is_hidden_branch_name(name) {
                return None;
            }
            let track = fields.next().unwrap_or_default();
            let upstream = fields
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty());
            Some((
                name.to_string(),
                track.to_string(),
                upstream.map(str::to_string),
            ))
        })
        .enumerate()
        .map(|(i, (name, track, upstream))| {
            let meta = if open_by_branch.contains_key(&name) {
                "open".to_string()
            } else {
                track_label(&track)
            };
            BranchInfo {
                current: current_branch == Some(name.as_str()),
                name,
                meta,
                color: colors[i % colors.len()].to_string(),
                upstream,
            }
        })
        .collect())
}

fn checked_out_branches(ctx: &RepositoryGroupContext) -> BTreeMap<String, String> {
    let output = git_in_group(ctx, &["worktree", "list", "--porcelain"]).unwrap_or_default();
    parse_worktree_porcelain(&output)
        .into_iter()
        .filter(|entry| !ctx.is_meta_worktree(&entry.path))
        .filter_map(|entry| entry.branch.map(|branch| (branch, entry.path)))
        .filter(|(branch, _)| !is_hidden_branch_name(branch))
        .collect()
}

fn remote_branches_for_group(ctx: &RepositoryGroupContext) -> Vec<String> {
    let output = git_in_group(
        ctx,
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/remotes/origin",
        ],
    )
    .unwrap_or_default();
    remote_branch_lines(output)
}

fn remote_branches_for_common_git_dir(common_git_dir: &Path) -> Vec<String> {
    let output = git_in_bare_repo(
        &common_git_dir.to_string_lossy(),
        &[
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/remotes/origin",
        ],
    )
    .unwrap_or_default();
    remote_branch_lines(output)
}

fn remote_branch_lines(output: String) -> Vec<String> {
    let mut branches = BTreeSet::new();
    for branch in lines(output) {
        if branch == "origin/HEAD" || branch.ends_with("/HEAD") || is_hidden_remote_branch(&branch)
        {
            continue;
        }
        branches.insert(branch);
    }
    branches.into_iter().collect()
}

fn default_branch_for_common_git_dir(common_git_dir: &Path) -> Option<String> {
    git_in_bare_repo(
        &common_git_dir.to_string_lossy(),
        &["symbolic-ref", "refs/remotes/origin/HEAD"],
    )
    .ok()
    .and_then(|value| {
        value
            .trim()
            .strip_prefix("refs/remotes/")
            .map(str::to_string)
    })
    .or_else(|| {
        remote_branches_for_common_git_dir(common_git_dir)
            .into_iter()
            .find(|branch| branch == "origin/main")
            .or_else(|| {
                remote_branches_for_common_git_dir(common_git_dir)
                    .into_iter()
                    .find(|branch| branch == "origin/master")
            })
    })
}

fn remote_meta_branch(remote_url: &str) -> Result<Option<String>, String> {
    let executable = git_executable();
    let output = Command::new(&executable)
        .arg("ls-remote")
        .arg("--heads")
        .arg(remote_url)
        .args(META_BRANCH_CANDIDATES.iter().copied())
        .output()
        .map_err(|e| format!("Failed to run {executable} ls-remote: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "Unable to inspect remote branches.".into()
        } else {
            stderr
        });
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    for preferred in META_BRANCH_CANDIDATES {
        if stdout.lines().any(|line| {
            line.trim_end()
                .ends_with(&format!("refs/heads/{preferred}"))
        }) {
            return Ok(Some((*preferred).to_string()));
        }
    }
    Ok(None)
}

fn remotes_for_group(ctx: &RepositoryGroupContext) -> Vec<RemoteInfo> {
    lines(git_in_group(ctx, &["remote"]).unwrap_or_default())
        .into_iter()
        .map(|name| {
            let url = git_in_group(ctx, &["remote", "get-url", &name])
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            let push_url = git_in_group(ctx, &["remote", "get-url", "--push", &name])
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());
            RemoteInfo {
                name,
                url,
                push_url,
            }
        })
        .collect()
}

fn is_hidden_branch_name(name: &str) -> bool {
    HIDDEN_UI_BRANCHES.contains(&name)
}

fn is_hidden_remote_branch(name: &str) -> bool {
    HIDDEN_UI_BRANCHES.iter().any(|hidden| {
        name.strip_suffix(hidden)
            .is_some_and(|prefix| prefix.ends_with('/'))
    })
}

fn track_label(track: &str) -> String {
    match track.trim() {
        "" => "local".into(),
        "=" => "tracked".into(),
        ">" => "ahead".into(),
        "<" => "behind".into(),
        "<>" => "diverged".into(),
        other => other.into(),
    }
}

fn normalize_remote_branch(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Choose a remote branch.".into());
    }
    Ok(trimmed
        .strip_prefix("refs/remotes/origin/")
        .or_else(|| trimmed.strip_prefix("origin/"))
        .unwrap_or(trimmed)
        .to_string())
}

fn validate_child_name(value: &str, label: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err(format!("{label} is required."));
    }
    if value.contains('/') || value.contains('\\') || value == "." || value == ".." {
        return Err(format!("{label} cannot contain path separators."));
    }
    Ok(())
}

fn validate_branch_name(value: &str) -> Result<(), String> {
    if value.is_empty() {
        return Err("Branch name is required.".into());
    }
    if value.starts_with('-') || value.contains("..") || value.ends_with('.') || value.contains(' ')
    {
        return Err("Branch name is not valid for a worktree.".into());
    }
    Ok(())
}

fn safe_worktree_name(branch: &str) -> String {
    let safe = branch
        .trim()
        .trim_start_matches("origin/")
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string();
    if safe.is_empty() {
        "worktree".into()
    } else {
        safe
    }
}

fn repository_name_from_url(remote_url: &str) -> String {
    let trimmed = remote_url.trim_end_matches('/');
    let last_segment = trimmed
        .rsplit(['/', ':'])
        .next()
        .unwrap_or("repository")
        .trim_end_matches(".git")
        .trim();
    if last_segment.is_empty() {
        "repository".into()
    } else {
        last_segment.into()
    }
}

fn expand_home_path(path: &str) -> PathBuf {
    if path == "~" {
        return home_dir().unwrap_or_else(|| PathBuf::from(path));
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(path)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn same_path(left: &str, right: &str) -> bool {
    let left = Path::new(left);
    let right = Path::new(right);
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
}
