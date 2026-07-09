/**
 * Shared frontend data contracts for snapshots returned by the Tauri backend.
 *
 * This file intentionally contains JSDoc typedefs instead of runtime values so the
 * current JavaScript/Svelte code can opt into type checking without a full build
 * migration to TypeScript.
 *
 * @typedef {'idle' | 'running' | 'refreshing' | 'cancelling'} JobStatus
 * @typedef {'commits' | 'changes'} WorkspacePage
 * @typedef {'staged' | 'unstaged' | 'commit' | string} FileSection
 * @typedef {'hunk' | 'same' | 'add' | 'remove' | 'file' | 'binary' | 'meta'} DiffRowType
 *
 * @typedef {object} RepoInfo
 * @property {string} name
 * @property {string} path
 * @property {string} currentBranch
 * @property {string | null=} upstream
 * @property {boolean} hasUpstream
 * @property {number} ahead
 * @property {number} behind
 * @property {number} changed
 * @property {number=} conflicts
 *
 * @typedef {object} BranchInfo
 * @property {string} name
 * @property {string} meta
 * @property {boolean=} current
 * @property {string} color
 * @property {string=} upstream
 *
 * @typedef {object} ContextMenuItem
 * @property {string=} label
 * @property {string=} icon
 * @property {boolean=} danger
 * @property {boolean=} disabled
 * @property {boolean=} separator
 * @property {() => void | Promise<void>=} action
 *
 * @typedef {object} FileTreeRow
 * @property {'folder' | 'file'} type
 * @property {string} path
 * @property {string} name
 * @property {number} depth
 * @property {FileSection} section
 * @property {boolean=} collapsed
 * @property {string[]=} childKeys
 * @property {ChangedFile=} file
 *
 * @typedef {object} ChangedFile
 * @property {string} status
 * @property {string} label
 * @property {string} path
 * @property {string} folder
 * @property {FileSection} section
 * @property {string} tone
 * @property {string} lines
 *
 * @typedef {object} DiffRow
 * @property {DiffRowType} type
 * @property {string | number} left
 * @property {string | number} right
 * @property {string} text
 * @property {number | null=} hunkIndex
 *
 * @typedef {object} ConflictOperation
 * @property {string} kind
 * @property {string} label
 * @property {string} gitCommand
 * @property {boolean} canContinue
 * @property {boolean} canAbort
 *
 * @typedef {object} ConflictFile
 * @property {string} path
 * @property {string} status
 * @property {string} kind
 * @property {string} kindLabel
 * @property {boolean} binary
 * @property {boolean} hasBase
 * @property {boolean} hasOurs
 * @property {boolean} hasTheirs
 *
 * @typedef {object} ConflictState
 * @property {boolean} active
 * @property {ConflictOperation | null=} operation
 * @property {string} operationLabel
 * @property {ConflictFile[]} files
 * @property {string} nextStep
 *
 * @typedef {object} ConflictPreviewSide
 * @property {string} label
 * @property {boolean} available
 * @property {boolean} binary
 * @property {boolean} truncated
 * @property {string[]} lines
 * @property {string} message
 *
 * @typedef {object} ConflictFilePreview
 * @property {ConflictFile} file
 * @property {ConflictPreviewSide} base
 * @property {ConflictPreviewSide} ours
 * @property {ConflictPreviewSide} theirs
 * @property {ConflictPreviewSide} result
 *
 * @typedef {object} CommitInfo
 * @property {string} id
 * @property {string} subject
 * @property {string} author
 * @property {string} date
 * @property {string} branch
 * @property {string[]} refs
 * @property {string[]} parents
 * @property {number} files
 * @property {number} insertions
 * @property {number} deletions
 * @property {string} lane
 * @property {number=} laneIndex
 * @property {number[]=} activeLanes
 * @property {string} message
 * @property {(ChangedFile[] | string[])} changedPaths
 * @property {boolean=} detailsLoaded
 *
 * @typedef {object} StashInfo
 * @property {string} reference
 * @property {string=} shortId
 * @property {string} message
 * @property {string} subject
 * @property {string} branch
 * @property {string} date
 * @property {number=} changedFiles
 *
 * @typedef {object} StashDiffInfo
 * @property {StashInfo} stash
 * @property {string | null=} selectedFilePath
 * @property {ChangedFile[]} changedPaths
 * @property {DiffRow[]} diffRows
 * @property {number} files
 * @property {number} insertions
 * @property {number} deletions
 *
 * @typedef {'large-diff' | 'file-history' | 'branch-history' | 'commit' | 'stashes'} InspectorType
 *
 * @typedef {object} InspectorDescriptor
 * @property {InspectorType} type
 * @property {string} repoPath
 * @property {object} params
 *
 * @typedef {object} CommitDiffInfo
 * @property {string} id
 * @property {string} shortId
 * @property {string} subject
 * @property {string} author
 * @property {string} authorEmail
 * @property {string} date
 * @property {string[]} refs
 * @property {string[]} parents
 * @property {number} files
 * @property {number} insertions
 * @property {number} deletions
 * @property {string} message
 * @property {string | null=} selectedFilePath
 * @property {ChangedFile[]} changedPaths
 * @property {DiffRow[]} diffRows
 *
 * @typedef {object} HistoryCommitInfo
 * @property {string} id
 * @property {string} shortId
 * @property {string[]} parents
 * @property {string} subject
 * @property {string} author
 * @property {string} date
 * @property {string[]} refs
 * @property {number} files
 * @property {number} insertions
 * @property {number} deletions
 * @property {number} binaryFiles
 * @property {string} lines
 *
 * @typedef {object} FileHistoryInfo
 * @property {string} path
 * @property {number} limit
 * @property {number} skip
 * @property {boolean} bestEffortRenameFollowing
 * @property {HistoryCommitInfo[]} entries
 *
 * @typedef {object} BranchHistoryInfo
 * @property {string} branchName
 * @property {string} kind
 * @property {boolean} current
 * @property {string | null=} upstream
 * @property {number} ahead
 * @property {number} behind
 * @property {number} limit
 * @property {number} skip
 * @property {HistoryCommitInfo[]} entries
 *
 * @typedef {object} RepoSnapshot
 * @property {RepoInfo} repo
 * @property {BranchInfo[]=} localBranches
 * @property {string[]} remotes
 * @property {string[]} tags
 * @property {StashInfo[]=} stashes
 * @property {CommitInfo[]} commits
 * @property {ChangedFile[]=} changedFiles
 * @property {Record<string, DiffRow[]>=} diffByFile
 * @property {ConflictState=} conflictState
 *
 * @typedef {object} AppSettings
 * @property {boolean} autoRefresh
 * @property {string[]} recentRepoPaths
 * @property {string} lastRepoPath
 * @property {string[]} openRepoPaths
 * @property {string} activeRepoPath
 *
 * @typedef {object} BackendRecovery
 * @property {string} hint
 * @property {boolean} showOpenRepository
 * @property {boolean} showPublishUpstream
 * @property {boolean=} showForceDeleteBranch
 *
 * @typedef {object} UserPreferences
 * @property {boolean} confirmDiscardChanges
 * @property {boolean} confirmResetBranch
 * @property {boolean} confirmForcePush
 * @property {boolean} confirmDeleteBranch
 * @property {boolean} confirmCancelOperations
 */

export {};
