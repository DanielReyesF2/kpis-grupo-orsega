// script to push schema to database automatically
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Pushing database schema...');

// Create the bash script that will automate the responses
const scriptContent = `#!/bin/bash
yes | npx drizzle-kit push
`;

const scriptPath = path.join(__dirname, 'push_schema.sh');
fs.writeFileSync(scriptPath, scriptContent);
fs.chmodSync(scriptPath, '755'); // Make it executable

// Execute the script
exec(scriptPath, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing script: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
  }
  
  console.log(`Schema pushed successfully`);
  console.log(stdout);
  
  // Clean up the temporary script
  fs.unlinkSync(scriptPath);
});