Source for office/addin/taskpane.js (the Outlook add-in task pane).
Rebuild: npm i @azure/msal-browser@3.27.0 esbuild@0.24.0, then
npx esbuild taskpane.src.js --bundle --minify --format=iife --target=es2020 --outfile=../../office/addin/taskpane.js
