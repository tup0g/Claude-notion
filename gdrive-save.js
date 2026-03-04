const fs = require('fs');
const path = require('path');
const { google } = require('./gdrive-auth/node_modules/googleapis');
const { OAuth2Client } = require('./gdrive-auth/node_modules/google-auth-library');

const CREDENTIALS_PATH = path.join(__dirname, 'gdrive-auth', 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'gdrive-auth', 'token.json');

const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

const auth = new OAuth2Client(client_id, client_secret, redirect_uris[0] || 'http://localhost');
auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')));

const drive = google.drive({ version: 'v3', auth });

const args = process.argv.slice(2);
const folderIndex = args.indexOf('--folder');
const folderId = folderIndex !== -1 ? args.splice(folderIndex, 2)[1] : null;
const filePath = args[0];

if (!filePath) {
    console.error('Usage: node gdrive-save.js <file-path> [--folder <gdrive-folder-id>]');
    process.exit(1);
}

const fileName = path.basename(filePath);
const mimeType = 'text/plain';

const requestBody = { name: fileName, mimeType };
if (folderId) requestBody.parents = [folderId];

drive.files.create({
    requestBody,
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id, name, webViewLink',
}).then(({ data }) => {
    console.log(`Uploaded: ${data.name}`);
    console.log(`ID: ${data.id}`);
    console.log(`Link: ${data.webViewLink}`);
}).catch(err => {
    console.error('Upload failed:', err.message);
    process.exit(1);
});
