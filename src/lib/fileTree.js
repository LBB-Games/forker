export function fileKey(file) {
  return `${file.section}:${file.path}`;
}

export function sectionFromKey(key) {
  return key.split(':', 1)[0] ?? '';
}

export function treeFolderKey(section, path) {
  return `${section}:${path}`;
}

export function sortFilesByPath(files) {
  return files.slice().sort((a, b) => a.path.localeCompare(b.path));
}

export function fileTreeRows(files, collapsedTreeFolders) {
  const rows = [];
  const seenFolders = new Set();

  for (const file of files) {
    const parts = file.path.split('/');
    let folderPath = '';
    let hidden = false;

    for (let depth = 0; depth < parts.length - 1; depth += 1) {
      folderPath = folderPath ? `${folderPath}/${parts[depth]}` : parts[depth];
      const folderKey = treeFolderKey(file.section, folderPath);

      if (!seenFolders.has(folderKey)) {
        seenFolders.add(folderKey);
        if (!hidden) {
          rows.push({
            type: 'folder',
            section: file.section,
            path: folderPath,
            name: parts[depth],
            depth,
            collapsed: collapsedTreeFolders.has(folderKey),
            childKeys: files
              .filter((childFile) => childFile.section === file.section && childFile.path.startsWith(`${folderPath}/`))
              .map(fileKey),
          });
        }
      }

      if (collapsedTreeFolders.has(folderKey)) hidden = true;
    }

    if (!hidden) {
      rows.push({
        type: 'file',
        path: file.path,
        name: parts.at(-1),
        depth: Math.max(parts.length - 1, 0),
        file,
      });
    }
  }

  return rows;
}
