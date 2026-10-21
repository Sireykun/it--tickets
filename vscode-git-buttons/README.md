# IT Desk Git Buttons for VS Code

This local extension adds **Pull** and **Push** buttons to the VS Code status bar
when a Git repository folder is open. If the folder has no `origin` remote, the
first button becomes **Connect GitHub** and asks for a repository URL.

Pull uses `git pull --ff-only` so it cannot silently create a merge commit.
Push sends committed changes. If files have changed, it offers to commit all
non-ignored files after you enter a commit message. Pull asks you to commit or
stash local changes first.

The installed copy is under your VS Code user extensions folder. After editing
this source, reinstall it and reload the VS Code window.
