use std::{
    env,
    io::Write,
    path::Path,
    process::{Command, Stdio},
};

use crate::{models::GitInstallation, settings::current_app_settings};

pub(crate) fn git_installation_impl() -> GitInstallation {
    let executable = git_executable();
    match Command::new(&executable).arg("--version").output() {
        Ok(output) if output.status.success() => GitInstallation {
            found: true,
            path: Some(executable),
            version: Some(String::from_utf8_lossy(&output.stdout).trim().to_string()),
            error: None,
        },
        Ok(output) => GitInstallation {
            found: false,
            path: Some(executable),
            version: None,
            error: Some(String::from_utf8_lossy(&output.stderr).trim().to_string()),
        },
        Err(error) => GitInstallation {
            found: false,
            path: Some(executable),
            version: None,
            error: Some(format!("Git executable could not be run: {error}")),
        },
    }
}

fn git_binary_path() -> Option<String> {
    let path_var = env::var_os("PATH")?;
    let binary_names: &[&str] = if cfg!(windows) {
        &["git.exe", "git"]
    } else {
        &["git"]
    };
    env::split_paths(&path_var)
        .flat_map(|dir| binary_names.iter().map(move |name| dir.join(name)))
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.display().to_string())
}

pub(crate) fn repo_root(path: &str) -> Result<String, String> {
    let root = git(path, &["rev-parse", "--show-toplevel"])?;
    let root = root.trim().to_string();
    if root.is_empty() || !Path::new(&root).exists() {
        Err(format!("Not a Git repository: {path}"))
    } else {
        Ok(root)
    }
}

pub(crate) fn current_branch(repo: &str) -> String {
    let b = git(repo, &["branch", "--show-current"])
        .unwrap_or_default()
        .trim()
        .to_string();
    if b.is_empty() {
        git(repo, &["rev-parse", "--short", "HEAD"])
            .unwrap_or_else(|_| "detached".into())
            .trim()
            .to_string()
    } else {
        b
    }
}

pub(crate) fn git_executable() -> String {
    let settings = current_app_settings();
    if settings.git_path_mode == "manual" && !settings.git_executable_path.trim().is_empty() {
        settings.git_executable_path.trim().to_string()
    } else {
        git_binary_path().unwrap_or_else(|| "git".into())
    }
}

pub(crate) fn git(repo: &str, args: &[&str]) -> Result<String, String> {
    git_in_worktree(repo, args)
}

pub(crate) fn git_in_worktree(worktree_path: &str, args: &[&str]) -> Result<String, String> {
    let executable = git_executable();
    let output = Command::new(&executable)
        .arg("-C")
        .arg(worktree_path)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;
    command_output(output)
}

pub(crate) fn git_in_bare_repo(common_git_dir: &str, args: &[&str]) -> Result<String, String> {
    let executable = git_executable();
    let output = Command::new(&executable)
        .arg(format!("--git-dir={common_git_dir}"))
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;
    command_output(output)
}

fn command_output(output: std::process::Output) -> Result<String, String> {
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Git command failed".into()
        } else {
            stderr
        })
    }
}

pub(crate) fn git_with_input(repo: &str, args: &[&str], input: &str) -> Result<String, String> {
    let executable = git_executable();
    let mut child = Command::new(&executable)
        .arg("-C")
        .arg(repo)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run {executable}: {e}"))?;

    child
        .stdin
        .as_mut()
        .ok_or_else(|| "Unable to open git stdin".to_string())?
        .write_all(input.as_bytes())
        .map_err(|e| format!("Unable to write patch to git: {e}"))?;

    let output = child
        .wait_with_output()
        .map_err(|e| format!("Failed to read git output: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "Git command failed".into()
        } else {
            stderr
        })
    }
}

pub(crate) fn lines(output: String) -> Vec<String> {
    output
        .lines()
        .map(str::trim)
        .filter(|l| !l.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

pub(crate) fn default_remote(repo: &str) -> Result<String, String> {
    let remotes = lines(git(repo, &["remote"])?);
    remotes
        .iter()
        .find(|remote| remote.as_str() == "origin")
        .or_else(|| remotes.first())
        .cloned()
        .ok_or_else(|| "No Git remote is configured for this repository.".into())
}
