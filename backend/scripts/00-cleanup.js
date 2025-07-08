const fs = require('fs');

console.log("Cleaning up old deployment files...");

// Remove old deployment files
const filesToRemove = [
  'factory-deployment.json',
  'deployment-complete.json',
  'deployment-base.json'
];

filesToRemove.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Removed ${file}`);
  }
});

console.log("Cleanup complete!");
