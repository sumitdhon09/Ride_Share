@echo off
cd /d C:\Users\dhond\Videos\Major-project
git add -A
git commit -m "feat: Improve passenger booking flow and map styling

- Add back button to booking flow (location, ride, payment steps)
- Fix route line to display actual road path instead of straight line
- Improve route line styling with white outline and blue color
- Use light map tiles in all themes (passenger, driver, admin)
- Make maps bright and visible in dark mode
- Fix admin dashboard header styling in light mode
- Update search input and button styling for better visibility

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push origin main
