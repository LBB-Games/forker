use crate::{
    changes::{branch_history, commit_details, commit_diff_info, file_history, parse_history_log},
    commands::{
        git_checkout_impl, git_checkout_remote_impl, git_commit_impl, git_create_branch_impl,
        git_discard_impl, git_discard_paths_impl, git_push_impl, git_push_upstream_impl,
        git_reset_branch_impl, git_stage_hunk, git_stage_impl, git_stash_diff, git_stash_impl,
        git_stash_list_impl, git_unstage_hunk, git_unstage_impl,
    },
    conflicts::{abort_conflict_operation, conflict_preview, mark_conflict_resolved},
    diff::{file_diff, parse_unified_diff_rows},
    git_process::{current_branch, git},
    repository_group::{create_worktree_impl, open_group_snapshot},
    snapshot::snapshot,
};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

struct TestRepo {
    path: PathBuf,
}

impl TestRepo {
    fn new(name: &str) -> Self {
        let mut path = env::temp_dir();
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        path.push(format!("git_desktop_client_{name}_{suffix}"));
        fs::create_dir_all(&path).unwrap();
        run_git(&path, &["init"]);
        run_git(&path, &["config", "user.email", "test@example.com"]);
        run_git(&path, &["config", "user.name", "Test User"]);
        Self { path }
    }

    fn path_str(&self) -> String {
        self.path.to_string_lossy().to_string()
    }

    fn write(&self, relative: &str, contents: &str) {
        let path = self.path.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, contents).unwrap();
    }

    fn commit_file(&self, relative: &str, contents: &str, message: &str) {
        self.write(relative, contents);
        run_git(&self.path, &["add", relative]);
        run_git(&self.path, &["commit", "-m", message]);
    }
}

impl Drop for TestRepo {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

struct TestBareRemote {
    path: PathBuf,
}

impl TestBareRemote {
    fn new(name: &str) -> Self {
        let mut path = env::temp_dir();
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        path.push(format!("git_desktop_client_{name}_{suffix}.git"));
        fs::create_dir_all(&path).unwrap();
        let output = Command::new("git")
            .arg("init")
            .arg("--bare")
            .arg(&path)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git init --bare failed: {}",
            String::from_utf8_lossy(&output.stderr)
        );
        Self { path }
    }

    fn path_str(&self) -> String {
        self.path.to_string_lossy().to_string()
    }
}

impl Drop for TestBareRemote {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn run_git(repo: &Path, args: &[&str]) {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
}

fn setup_meta_checkout_group(name: &str) -> (TestRepo, PathBuf) {
    let repo = TestRepo::new(name);
    repo.commit_file("README.md", "seed\n", "seed");
    run_git(&repo.path, &["checkout", "-b", "repo-meta"]);
    run_git(&repo.path, &["branch", "dev"]);
    repo.commit_file("META.md", "coordination\n", "meta-only commit");
    let worktrees_dir = repo.path.join("worktrees");
    fs::create_dir_all(&worktrees_dir).unwrap();
    let child = worktrees_dir.join("forker");
    let child_string = child.to_string_lossy().to_string();
    run_git(&repo.path, &["worktree", "add", &child_string, "dev"]);
    (repo, child)
}

#[test]
fn meta_checkout_group_hides_meta_worktree_and_branch() {
    let (repo, child) = setup_meta_checkout_group("meta_group");

    let group = open_group_snapshot(&repo.path_str(), None).unwrap();

    assert_eq!(group.worktrees.len(), 1);
    assert!(same_path_for_test(&group.worktrees[0].path, &child));
    assert_eq!(
        group.active_worktree.as_ref().unwrap().repo.current_branch,
        "dev"
    );
    assert!(group
        .local_branches
        .iter()
        .any(|branch| branch.name == "dev"));
    assert!(!group
        .local_branches
        .iter()
        .any(|branch| branch.name == "repo-meta"));
    assert!(!group
        .active_worktree
        .as_ref()
        .unwrap()
        .commits
        .iter()
        .any(|commit| commit.subject == "meta-only commit"
            || commit.branch == "repo-meta"
            || commit
                .refs
                .iter()
                .any(|reference| reference.contains("repo-meta"))));
}

#[test]
fn meta_checkout_child_opens_parent_group_and_selects_child() {
    let (_repo, child) = setup_meta_checkout_group("meta_child");

    let group = open_group_snapshot(&child.to_string_lossy(), None).unwrap();

    assert_eq!(group.worktrees.len(), 1);
    assert!(same_path_for_test(
        &group.group.root_path,
        child.parent().unwrap().parent().unwrap()
    ));
    assert_eq!(
        group.active_worktree.as_ref().unwrap().repo.current_branch,
        "dev"
    );
}

#[test]
fn meta_checkout_create_worktree_uses_worktrees_folder() {
    let (repo, _child) = setup_meta_checkout_group("meta_create");
    run_git(&repo.path, &["branch", "feature"]);

    let group = create_worktree_impl(&repo.path_str(), "feature", "feature", None).unwrap();
    let expected = repo.path.join("worktrees").join("feature");

    assert!(expected.is_dir());
    assert!(group
        .worktrees
        .iter()
        .any(|worktree| same_path_for_test(&worktree.path, &expected)));
}

fn same_path_for_test(left: &str, right: impl AsRef<Path>) -> bool {
    match (
        Path::new(left).canonicalize(),
        right.as_ref().canonicalize(),
    ) {
        (Ok(left), Ok(right)) => left == right,
        _ => Path::new(left) == right.as_ref(),
    }
}

#[test]
fn snapshot_reads_commits_branches_and_changed_files() {
    let repo = TestRepo::new("snapshot");
    repo.commit_file("README.md", "hello\n", "initial commit");
    repo.write("README.md", "hello\nworld\n");
    repo.write("src/new.txt", "new\n");

    let snapshot = snapshot(&repo.path_str()).unwrap();

    assert_eq!(snapshot.repo.changed, 2);
    assert_eq!(snapshot.commits[0].subject, "initial commit");
    assert!(snapshot.local_branches.iter().any(|branch| branch.current));
    assert!(snapshot
        .changed_files
        .iter()
        .any(|file| file.path == "README.md" && file.section == "unstaged"));
    assert!(snapshot
        .changed_files
        .iter()
        .any(|file| file.path == "src/" && file.status == "?"));
}

#[test]
fn changed_files_keep_space_paths_unquoted() {
    let repo = TestRepo::new("space_paths");
    repo.commit_file(
        "Assets/Packet Jammer Active Item Behavior.asset",
        "seed\n",
        "seed",
    );
    repo.write(
        "Assets/Packet Jammer Active Item Behavior.asset",
        "seed\nchanged\n",
    );
    repo.write("Assets/_Recovery/0 (1).unity", "scene\n");
    repo.write("Scratch File.txt", "scratch\n");

    let snapshot = snapshot(&repo.path_str()).unwrap();

    assert!(snapshot.changed_files.iter().any(|file| {
        file.path == "Assets/Packet Jammer Active Item Behavior.asset" && file.section == "unstaged"
    }));
    assert!(snapshot
        .changed_files
        .iter()
        .any(|file| { file.path == "Scratch File.txt" && file.status == "?" }));
    assert!(snapshot
        .changed_files
        .iter()
        .all(|file| !file.path.starts_with('"')));
}

#[test]
fn stage_unstage_and_commit_update_repository_state() {
    let repo = TestRepo::new("write_ops");
    repo.commit_file("app.txt", "one\n", "seed");
    repo.write("app.txt", "one\ntwo\n");

    let staged = git_stage_impl(repo.path_str(), Some("app.txt".into())).unwrap();
    assert!(staged
        .changed_files
        .iter()
        .any(|file| file.path == "app.txt" && file.section == "staged"));

    let unstaged = git_unstage_impl(repo.path_str(), Some("app.txt".into())).unwrap();
    assert!(unstaged
        .changed_files
        .iter()
        .all(|file| file.section != "staged"));

    git_stage_impl(repo.path_str(), Some("app.txt".into())).unwrap();
    let committed = git_commit_impl(
        repo.path_str(),
        "update app".into(),
        "body".into(),
        false,
        false,
    )
    .unwrap();
    assert_eq!(committed.repo.changed, 0);
    assert_eq!(committed.commits[0].subject, "update app");
}

#[test]
fn stage_and_unstage_single_hunks() {
    let repo = TestRepo::new("hunk_ops");
    let original = (1..=20)
        .map(|line| format!("line {line}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    repo.commit_file("notes.txt", &original, "seed");

    let changed = original
        .replace("line 2\n", "line two\n")
        .replace("line 18\n", "line eighteen\n");
    repo.write("notes.txt", &changed);

    git_stage_hunk(repo.path_str(), "notes.txt".into(), 0).unwrap();
    let staged = git(&repo.path_str(), &["diff", "--cached", "--", "notes.txt"]).unwrap();
    let unstaged = git(&repo.path_str(), &["diff", "--", "notes.txt"]).unwrap();
    assert!(staged.contains("line two"));
    assert!(!staged.contains("line eighteen"));
    assert!(unstaged.contains("line eighteen"));

    git_unstage_hunk(repo.path_str(), "notes.txt".into(), 0).unwrap();
    let staged = git(&repo.path_str(), &["diff", "--cached", "--", "notes.txt"]).unwrap();
    assert!(staged.trim().is_empty());
}

#[test]
fn branch_checkout_discard_and_refresh_work() {
    let repo = TestRepo::new("branch_ops");
    repo.commit_file("tracked.txt", "original\n", "seed");

    let branched = git_create_branch_impl(repo.path_str(), "feature/test".into(), true).unwrap();
    assert_eq!(branched.repo.current_branch, "feature/test");

    repo.write("tracked.txt", "changed\n");
    let dirty = snapshot(&repo.path_str()).unwrap();
    assert_eq!(dirty.repo.changed, 1);

    let clean = git_discard_impl(repo.path_str(), "tracked.txt".into()).unwrap();
    assert_eq!(clean.repo.changed, 0);

    let checked_out = git_checkout_impl(repo.path_str(), "master".into())
        .or_else(|_| git_checkout_impl(repo.path_str(), "main".into()))
        .unwrap();
    assert_ne!(checked_out.repo.current_branch, "feature/test");
}

#[test]
fn checkout_remote_branch_creates_tracking_local_branch() {
    let mut remote_path = env::temp_dir();
    let suffix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    remote_path.push(format!("git_desktop_client_remote_{suffix}.git"));
    fs::create_dir_all(&remote_path).unwrap();
    let output = Command::new("git")
        .arg("init")
        .arg("--bare")
        .arg(&remote_path)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "git init --bare failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let repo = TestRepo::new("remote_checkout");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    let base_branch = current_branch(&repo.path_str());
    run_git(
        &repo.path,
        &["remote", "add", "origin", remote_path.to_str().unwrap()],
    );
    run_git(&repo.path, &["push", "-u", "origin", &base_branch]);
    run_git(&repo.path, &["checkout", "-b", "feature/remote-only"]);
    repo.commit_file("feature.txt", "remote\n", "remote feature");
    run_git(&repo.path, &["push", "-u", "origin", "feature/remote-only"]);
    run_git(&repo.path, &["checkout", &base_branch]);
    run_git(&repo.path, &["branch", "-D", "feature/remote-only"]);
    run_git(&repo.path, &["fetch", "origin"]);

    let snapshot =
        git_checkout_remote_impl(repo.path_str(), "origin/feature/remote-only".into()).unwrap();
    assert_eq!(snapshot.repo.current_branch, "feature/remote-only");
    assert!(snapshot
        .local_branches
        .iter()
        .any(|branch| branch.name == "feature/remote-only"
            && branch.upstream.as_deref() == Some("origin/feature/remote-only")));

    let _ = fs::remove_dir_all(remote_path);
}

#[test]
fn discard_removes_untracked_files() {
    let repo = TestRepo::new("discard_untracked");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    repo.write("scratch.txt", "temporary\n");

    let dirty = snapshot(&repo.path_str()).unwrap();
    assert!(dirty
        .changed_files
        .iter()
        .any(|file| file.path == "scratch.txt" && file.status == "?"));

    let clean = git_discard_impl(repo.path_str(), "scratch.txt".into()).unwrap();
    assert_eq!(clean.repo.changed, 0);
    assert!(!repo.path.join("scratch.txt").exists());
}

#[test]
fn discard_paths_removes_multiple_worktree_changes() {
    let repo = TestRepo::new("discard_paths");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    repo.write("tracked.txt", "dirty\n");
    repo.write("scratch.txt", "temporary\n");

    let clean = git_discard_paths_impl(
        repo.path_str(),
        vec!["tracked.txt".into(), "scratch.txt".into()],
    )
    .unwrap();

    assert_eq!(clean.repo.changed, 0);
    assert_eq!(
        fs::read_to_string(repo.path.join("tracked.txt")).unwrap(),
        "seed\n"
    );
    assert!(!repo.path.join("scratch.txt").exists());
}

#[test]
fn reset_branch_hard_discards_conflicting_worktree_changes() {
    let repo = TestRepo::new("reset_hard");
    repo.commit_file("tracked.txt", "base\n", "base");
    repo.commit_file("tracked.txt", "second\n", "second");
    repo.write("tracked.txt", "dirty\n");

    let reset = git_reset_branch_impl(repo.path_str(), "HEAD~1".into(), "hard".into()).unwrap();

    assert_eq!(reset.repo.changed, 0);
    assert_eq!(
        fs::read_to_string(repo.path.join("tracked.txt")).unwrap(),
        "base\n"
    );
    assert!(git_reset_branch_impl(repo.path_str(), "HEAD".into(), "unsafe".into()).is_err());
}

#[test]
fn snapshot_reports_merge_conflicts_and_preview_sides() {
    let repo = TestRepo::new("merge_conflict");
    repo.commit_file("tracked.txt", "base\n", "base");
    let original_branch = current_branch(&repo.path_str());
    run_git(&repo.path, &["checkout", "-b", "feature"]);
    repo.commit_file("tracked.txt", "theirs\n", "feature change");
    run_git(&repo.path, &["checkout", &original_branch]);
    repo.commit_file("tracked.txt", "ours\n", "main change");

    let output = Command::new("git")
        .arg("-C")
        .arg(&repo.path)
        .args(["merge", "feature"])
        .output()
        .unwrap();
    assert!(!output.status.success());

    let conflicted = snapshot(&repo.path_str()).unwrap();
    assert!(conflicted.conflict_state.active);
    assert_eq!(conflicted.conflict_state.operation_label, "Merge");
    assert_eq!(conflicted.conflict_state.files.len(), 1);
    assert_eq!(conflicted.conflict_state.files[0].kind, "both_modified");
    let preview = conflict_preview(&repo.path_str(), "tracked.txt").unwrap();
    assert!(preview.ours.lines.iter().any(|line| line == "ours"));
    assert!(preview.theirs.lines.iter().any(|line| line == "theirs"));
    assert!(preview
        .result
        .lines
        .iter()
        .any(|line| line.starts_with("<<<<<<<")));

    repo.write("tracked.txt", "resolved\n");
    let marked = mark_conflict_resolved(repo.path_str(), "tracked.txt".into()).unwrap();
    assert!(marked.conflict_state.active);
    assert!(marked.conflict_state.files.is_empty());

    let aborted = abort_conflict_operation(repo.path_str()).unwrap();
    assert!(!aborted.conflict_state.active);
}

#[test]
fn stash_includes_untracked_changes_and_cleans_worktree() {
    let repo = TestRepo::new("stash_untracked");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    repo.write("tracked.txt", "dirty\n");
    repo.write("scratch.txt", "temporary\n");

    let stashed = git_stash_impl(repo.path_str()).unwrap();
    let stash_list = git_stash_list_impl(&repo.path_str()).unwrap();
    let stash_diff = git_stash_diff(
        repo.path_str(),
        "stash@{0}".into(),
        Some("tracked.txt".into()),
        Some(3),
    )
    .unwrap();

    assert_eq!(stashed.repo.changed, 0);
    assert_eq!(stashed.stashes.len(), 1);
    assert_eq!(stash_list[0].reference, "stash@{0}");
    assert!(stash_list[0].changed_files >= 1);
    assert!(stash_diff
        .changed_paths
        .iter()
        .any(|file| file.path == "tracked.txt"));
    assert!(stash_diff.diff_rows.iter().any(|row| row["type"] == "add"));
    assert!(!repo.path.join("scratch.txt").exists());
}

#[test]
fn push_upstream_sets_tracking_branch_and_push_updates_ahead_count() {
    let remote = TestBareRemote::new("push_upstream");
    let repo = TestRepo::new("push_upstream");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    run_git(&repo.path, &["remote", "add", "origin", &remote.path_str()]);
    let branch_name = current_branch(&repo.path_str());
    let upstream_name = format!("origin/{branch_name}");

    let published = git_push_upstream_impl(repo.path_str()).unwrap();
    assert!(published.repo.has_upstream);
    assert!(published.local_branches.iter().any(|branch| {
        branch.current && branch.upstream.as_deref() == Some(upstream_name.as_str())
    }));

    repo.write("tracked.txt", "seed\nnext\n");
    git_stage_impl(repo.path_str(), Some("tracked.txt".into())).unwrap();
    git_commit_impl(repo.path_str(), "next".into(), "".into(), false, false).unwrap();

    let pushed = git_push_impl(repo.path_str()).unwrap();
    assert_eq!(pushed.repo.ahead, 0);
}

#[test]
fn diff_parser_reports_binary_and_rename_metadata() {
    let rows = parse_unified_diff_rows(
            "diff --git a/old.bin b/new.bin\nsimilarity index 100%\nrename from old.bin\nrename to new.bin\nBinary files a/old.bin and b/new.bin differ\n",
        );
    assert!(rows.iter().any(|row| row["type"] == "meta"));
    assert!(rows.iter().any(|row| row["type"] == "binary"));
}

#[test]
fn untracked_binary_file_diff_is_safe() {
    let repo = TestRepo::new("binary_untracked");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    fs::write(repo.path.join("image.bin"), [0, 159, 146, 150]).unwrap();

    let rows = file_diff(&repo.path_str(), "image.bin", false, "?", None).unwrap();
    assert_eq!(rows[0]["type"], "binary");
}

#[test]
fn history_log_parser_sums_text_and_binary_stats() {
    let output = "\u{1e}abcdef123456\u{1f}abcdef1\u{1f}1234567\u{1f}update assets\u{1f}Test User\u{1f}06/24/26 10:42\u{1f}main\n3\t1\tsrc/app.rs\n-\t-\timage.bin\n";

    let entries = parse_history_log(output);

    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].files, 2);
    assert_eq!(entries[0].insertions, 3);
    assert_eq!(entries[0].deletions, 1);
    assert_eq!(entries[0].binary_files, 1);
    assert!(entries[0].refs.contains(&"main".to_string()));
}

#[test]
fn commit_diff_info_handles_root_and_binary_commits() {
    let repo = TestRepo::new("commit_diff_info");
    repo.write("README.md", "hello\n");
    fs::write(repo.path.join("image.bin"), [0, 159, 146, 150]).unwrap();
    run_git(&repo.path, &["add", "."]);
    run_git(&repo.path, &["commit", "-m", "initial assets"]);
    let head = git(&repo.path_str(), &["rev-parse", "HEAD"]).unwrap();

    let info = commit_diff_info(&repo.path_str(), head.trim(), None, Some(3)).unwrap();
    let binary_info =
        commit_diff_info(&repo.path_str(), head.trim(), Some("image.bin"), Some(3)).unwrap();

    assert_eq!(info.subject, "initial assets");
    assert_eq!(info.parents.len(), 0);
    assert!(info
        .changed_paths
        .iter()
        .any(|file| file.path == "README.md"));
    assert!(binary_info
        .diff_rows
        .iter()
        .any(|row| row["type"] == "binary"));
}

#[test]
fn file_history_follows_renames_when_git_can_resolve_them() {
    let repo = TestRepo::new("file_history_rename");
    repo.commit_file("old.txt", "one\n", "seed old file");
    run_git(&repo.path, &["mv", "old.txt", "new.txt"]);
    run_git(&repo.path, &["commit", "-m", "rename old file"]);

    let history = file_history(&repo.path_str(), "new.txt", Some(10), None).unwrap();

    assert!(history.best_effort_rename_following);
    assert!(history
        .entries
        .iter()
        .any(|entry| entry.subject == "rename old file"));
    assert!(history
        .entries
        .iter()
        .any(|entry| entry.subject == "seed old file"));
}

#[test]
fn branch_history_reports_branch_commits_without_changing_selection() {
    let repo = TestRepo::new("branch_history");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    run_git(&repo.path, &["checkout", "-b", "feature/history"]);
    repo.commit_file("feature.txt", "feature\n", "feature commit");

    let history = branch_history(&repo.path_str(), "feature/history", Some(20), None).unwrap();

    assert_eq!(history.branch_name, "feature/history");
    assert_eq!(history.kind, "local");
    assert!(history.current);
    assert!(history
        .entries
        .iter()
        .any(|entry| entry.subject == "feature commit"));
}

#[test]
fn detached_head_snapshot_is_safe() {
    let repo = TestRepo::new("detached");
    repo.commit_file("tracked.txt", "seed\n", "seed");
    let head = git(&repo.path_str(), &["rev-parse", "HEAD"]).unwrap();
    run_git(&repo.path, &["checkout", head.trim()]);

    let snapshot = snapshot(&repo.path_str()).unwrap();
    assert!(!snapshot.repo.current_branch.is_empty());
    assert!(!snapshot.repo.has_upstream);
}

#[test]
fn commit_graph_lanes_include_merge_parents() {
    let repo = TestRepo::new("graph_merge");
    repo.commit_file("base.txt", "base\n", "base");
    let base_branch = current_branch(&repo.path_str());
    run_git(&repo.path, &["checkout", "-b", "feature"]);
    repo.commit_file("feature.txt", "feature\n", "feature");
    run_git(&repo.path, &["checkout", &base_branch]);
    repo.commit_file("main.txt", "main\n", "main");
    run_git(
        &repo.path,
        &["merge", "--no-ff", "feature", "-m", "merge feature"],
    );

    let snapshot = snapshot(&repo.path_str()).unwrap();
    let merge = snapshot
        .commits
        .iter()
        .find(|commit| commit.subject == "merge feature")
        .unwrap();
    assert_eq!(merge.parents.len(), 2);
    assert!(merge.graph.parent_lanes.len() >= 2);
    assert!(merge.graph.lane_count >= 1);
}

#[test]
fn merge_commit_details_show_first_parent_changes() {
    let repo = TestRepo::new("merge_details");
    repo.commit_file("base.txt", "base\n", "base");
    let base_branch = current_branch(&repo.path_str());
    run_git(&repo.path, &["checkout", "-b", "feature"]);
    repo.commit_file("feature.txt", "feature\n", "feature");
    run_git(&repo.path, &["checkout", &base_branch]);
    repo.commit_file("main.txt", "main\n", "main");
    run_git(
        &repo.path,
        &["merge", "--no-ff", "feature", "-m", "merge feature"],
    );

    let merge = git(&repo.path_str(), &["rev-parse", "--short", "HEAD"]).unwrap();
    let details = commit_details(&repo.path_str(), merge.trim()).unwrap();

    assert_eq!(details.files, 1);
    assert!(details
        .changed_paths
        .iter()
        .any(|file| file.path == "feature.txt" && file.status == "A"));
}
