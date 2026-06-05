# 1. Create a brand new, disconnected branch with zero history
git checkout --orphan temp_branch

# 2. Explicitly remove .env from the staging area to guarantee it isn't tracked
git rm --cached .env

# 3. Stage all your current, safe files
git add .

# 4. Create a fresh, single commit
git commit -m "Clean commit: wiped history and removed AWS secrets"

# 5. Delete your old, tangled local main branch
git branch -D main

# 6. Rename your new clean branch to main
git branch -m main

# 7. Force push to GitHub to wipe and replace the remote history
git push -f origin main