use std::{
    collections::{BTreeSet, HashSet},
    path::Path,
};

use crate::{
    changes::changed_files,
    commands::git_stash_list_impl,
    conflicts::conflict_state,
    git_process::{current_branch, git, lines, repo_root},
    models::{BranchInfo, CommitGraphInfo, CommitInfo, RepoInfo, RepoSnapshot},
};

const HIDDEN_UI_BRANCHES: &[&str] = &["repo.meta", "repo-meta"];

pub(crate) fn snapshot(path: &str) -> Result<RepoSnapshot, String> {
    let root = repo_root(path)?;
    let current_branch = current_branch(&root);
    let upstream = upstream_branch(&root);
    let has_upstream = upstream.is_some();
    let (ahead, behind) = ahead_behind(&root);
    let changed_files = changed_files(&root)?;
    let conflict_state = conflict_state(&root);
    let commits = commits(&root, &current_branch).unwrap_or_default();
    let local_branches = branches(&root, &current_branch)?;
    let remotes = remote_branches(&root);
    let tags = lines(git(&root, &["tag", "--sort=-creatordate"]).unwrap_or_default())
        .into_iter()
        .take(24)
        .collect();
    let stashes = git_stash_list_impl(&root).unwrap_or_default();
    // Diffs are intentionally loaded lazily by `git_file_diff`. Precomputing them here
    // makes opening large repositories painfully slow because it may spawn dozens of
    // expensive `git diff` processes and read large untracked files before the user has
    // selected anything.
    let diff_by_file = serde_json::Map::new();
    let name = Path::new(&root)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Repository")
        .to_string();
    Ok(RepoSnapshot {
        repo: RepoInfo {
            name,
            path: root,
            current_branch,
            upstream,
            has_upstream,
            ahead,
            behind,
            changed: changed_files.len(),
            conflicts: conflict_state.files.len(),
        },
        local_branches,
        remotes,
        tags,
        stashes,
        commits,
        changed_files,
        diff_by_file,
        conflict_state,
    })
}

fn upstream_branch(repo: &str) -> Option<String> {
    git(
        repo,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

fn remote_branches(repo: &str) -> Vec<String> {
    let mut branches = BTreeSet::new();

    for output in [
        git(
            repo,
            &["for-each-ref", "--format=%(refname:short)", "refs/remotes"],
        )
        .unwrap_or_default(),
        git(repo, &["branch", "-r", "--format=%(refname:short)"]).unwrap_or_default(),
    ] {
        for branch in lines(output) {
            if !branch.ends_with("/HEAD") && !is_hidden_remote_branch(&branch) {
                branches.insert(branch);
            }
        }
    }

    branches.into_iter().collect()
}

fn ahead_behind(repo: &str) -> (usize, usize) {
    let Ok(output) = git(
        repo,
        &["rev-list", "--left-right", "--count", "@{upstream}...HEAD"],
    ) else {
        return (0, 0);
    };
    let mut parts = output.split_whitespace();
    let behind = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    let ahead = parts.next().and_then(|p| p.parse().ok()).unwrap_or(0);
    (ahead, behind)
}

fn branches(repo: &str, current_branch: &str) -> Result<Vec<BranchInfo>, String> {
    let output = git(
        repo,
        &[
            "branch",
            "--format=%(refname:short)|%(upstream:trackshort)|%(upstream:short)",
        ],
    )?;
    let colors = ["blue", "violet", "amber", "green"];
    Ok(output
        .lines()
        .enumerate()
        .filter_map(|(i, line)| {
            let mut fields = line.split('|');
            let name = fields.next().unwrap_or_default();
            let track = fields.next().unwrap_or_default();
            let upstream = fields
                .next()
                .map(str::trim)
                .filter(|value| !value.is_empty());
            let name = name.trim();
            if name.is_empty() || is_hidden_branch_name(name) {
                return None;
            }
            Some(BranchInfo {
                name: name.to_string(),
                meta: track_label(track),
                current: name == current_branch,
                color: colors[i % colors.len()].to_string(),
                upstream: upstream.map(str::to_string),
            })
        })
        .collect())
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

fn commits(repo: &str, current_branch: &str) -> Result<Vec<CommitInfo>, String> {
    let output = git(
        repo,
        &[
            "log",
            "--date=format:%m/%d/%y %H:%M",
            "--exclude=repo-meta",
            "--branches",
            "--exclude=*/repo-meta",
            "--remotes",
            "--tags",
            "--topo-order",
            "--decorate=short",
            "--decorate-refs-exclude=refs/heads/repo-meta",
            "--decorate-refs-exclude=refs/remotes/*/repo-meta",
            "--pretty=format:%h%x1f%p%x1f%s%x1f%an%x1f%ad%x1f%D",
            "-n",
            "120",
        ],
    )?;
    let mut parsed = output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| {
            let mut f = line.split('\u{1f}');
            let id = f.next().unwrap_or_default().trim().to_string();
            let parents = parse_parents(f.next().unwrap_or_default());
            let subject = f.next().unwrap_or_default().to_string();
            let author = f.next().unwrap_or_default().to_string();
            let date = f.next().unwrap_or_default().to_string();
            let refs = parse_refs(f.next().unwrap_or_default());
            let message = subject.clone();
            let branch = refs
                .iter()
                .find(|r| !r.starts_with("tag: ") && !r.contains('/'))
                .cloned()
                .unwrap_or_else(|| current_branch.to_string());
            CommitInfo {
                id,
                subject,
                author,
                date,
                branch,
                refs,
                parents,
                files: 0,
                insertions: 0,
                deletions: 0,
                lane: "main".into(),
                graph: CommitGraphInfo::default(),
                message,
                changed_paths: Vec::new(),
            }
        })
        .collect::<Vec<_>>();
    assign_commit_graph(&mut parsed);
    Ok(parsed)
}

fn assign_commit_graph(commits: &mut [CommitInfo]) {
    let visible_ids = commits
        .iter()
        .map(|commit| commit.id.clone())
        .collect::<HashSet<_>>();
    let mut active_lanes: Vec<Option<String>> = Vec::new();

    for commit in commits {
        let parents = commit
            .parents
            .iter()
            .filter(|parent| visible_ids.contains(parent.as_str()))
            .cloned()
            .collect::<Vec<_>>();
        let node_lane = active_lanes
            .iter()
            .position(|lane| lane.as_deref() == Some(commit.id.as_str()))
            .unwrap_or_else(|| {
                let lane = first_empty_graph_lane(&active_lanes);
                if lane == active_lanes.len() {
                    active_lanes.push(Some(commit.id.clone()));
                } else {
                    active_lanes[lane] = Some(commit.id.clone());
                }
                lane
            });

        let top_lanes = graph_lane_indexes(&active_lanes);
        let mut next_lanes = active_lanes.clone();
        let mut parent_lanes = Vec::new();

        if let Some(first_parent) = parents.first() {
            let existing_parent_lane = next_lanes
                .iter()
                .enumerate()
                .find(|(index, lane)| {
                    *index != node_lane && lane.as_deref() == Some(first_parent.as_str())
                })
                .map(|(index, _)| index);
            if let Some(parent_lane) = existing_parent_lane {
                next_lanes[node_lane] = None;
                parent_lanes.push(parent_lane);
            } else {
                next_lanes[node_lane] = Some(first_parent.clone());
                parent_lanes.push(node_lane);
            }
            for parent in parents.iter().skip(1) {
                let parent_lane = next_lanes
                    .iter()
                    .position(|lane| lane.as_deref() == Some(parent.as_str()))
                    .unwrap_or_else(|| {
                        let lane = first_empty_graph_lane(&next_lanes);
                        if lane == next_lanes.len() {
                            next_lanes.push(Some(parent.clone()));
                        } else {
                            next_lanes[lane] = Some(parent.clone());
                        }
                        lane
                    });
                parent_lanes.push(parent_lane);
            }
        } else if node_lane < next_lanes.len() {
            next_lanes[node_lane] = None;
        }

        trim_empty_graph_lanes(&mut next_lanes);
        let bottom_lanes = graph_lane_indexes(&next_lanes);
        let lane_count = active_lanes
            .len()
            .max(next_lanes.len())
            .max(node_lane + 1)
            .max(1);
        commit.lane = format!("lane-{node_lane}");
        commit.graph = CommitGraphInfo {
            node_lane,
            lane_count,
            top_lanes,
            bottom_lanes,
            parent_lanes: if parent_lanes.is_empty() {
                vec![node_lane]
            } else {
                parent_lanes
            },
        };
        active_lanes = next_lanes;
    }
}

fn graph_lane_indexes(lanes: &[Option<String>]) -> Vec<usize> {
    lanes
        .iter()
        .enumerate()
        .filter_map(|(index, lane)| lane.as_ref().map(|_| index))
        .collect()
}

fn first_empty_graph_lane(lanes: &[Option<String>]) -> usize {
    lanes
        .iter()
        .position(Option::is_none)
        .unwrap_or(lanes.len())
}

fn trim_empty_graph_lanes(lanes: &mut Vec<Option<String>>) {
    while lanes.last().map(Option::is_none).unwrap_or(false) {
        lanes.pop();
    }
}

fn parse_parents(parents: &str) -> Vec<String> {
    parents
        .split_whitespace()
        .map(str::trim)
        .filter(|parent| !parent.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_refs(refs: &str) -> Vec<String> {
    refs.split(',')
        .map(str::trim)
        .filter(|r| !r.is_empty() && *r != "HEAD")
        .map(|r| r.strip_prefix("HEAD -> ").unwrap_or(r))
        .filter(|r| !is_hidden_ref_name(r))
        .map(str::to_string)
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

fn is_hidden_ref_name(name: &str) -> bool {
    is_hidden_branch_name(name) || is_hidden_remote_branch(name)
}
