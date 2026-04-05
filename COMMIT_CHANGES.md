GIT PUSH SUMMARY
================

Files Modified:
1. ridesharelive-frontend-main/src/components/BookingPanel.jsx
   - Added getPreviousStep() function
   - Added Back button to booking flow footer
   - Updated footer layout with flex grid for Back + Next buttons

2. ridesharelive-frontend-main/src/components/ConfirmButton.jsx
   - Added className parameter for flexible sizing
   - Updated className handling in button styling

3. ridesharelive-frontend-main/src/components/CompactMap.jsx
   - Fixed route line to use actual route.path instead of straight line
   - Reordered viewport calculation to prioritize route path
   - Moved polyline rendering before markers for proper layering
   - Improved polyline styling with white outline and blue color

4. ridesharelive-frontend-main/src/components/RideStatus.jsx
   - Changed map layer from 'mapnik' (dark) to 'hotosm' (light)

5. ridesharelive-frontend-main/src/components/LiveMapPanel.jsx
   - Changed resolveMapTone() to always return 'light' for all themes

6. ridesharelive-frontend-main/src/components/AdminHeader.jsx
   - Updated search input background from slate-50 to white
   - Updated date range button styling for light mode
   - Updated Alerts button styling for light mode
   - Updated Export CSV button styling for light mode
   - Improved light mode button contrast and hover states

CHANGES SUMMARY:
================
✅ Add back button to booking flow
✅ Fix route line display on actual roads
✅ Improve route line styling
✅ Make maps light in all themes
✅ Fix admin header styling
✅ Better light mode button visibility

To push changes:
1. Run: git add -A
2. Run: git commit -m "feat: Improve passenger booking flow and map styling..."
3. Run: git push origin main
