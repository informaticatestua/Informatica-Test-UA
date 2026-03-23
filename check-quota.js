const https = require('https');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('data-migration/service-account.json', 'utf-8'));
const projectId = serviceAccount.project_id;

// We will attempt to use the built-in google-auth-library included with firebase-admin 
// to get an access token and perform a direct REST API call.
const { GoogleAuth } = require('google-auth-library');

async function testQuota() {
    try {
        const auth = new GoogleAuth({
            keyFilename: 'data-migration/service-account.json',
            scopes: ['https://www.googleapis.com/auth/datastore']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/courses/test-quota-check?documentId=testdoc123`;
        
        const response = await fetch(url, {
            method: 'PATCH', // To create or update a document
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fields: { test: { stringValue: "hello" } } })
        });
        
        const data = await response.json();
        console.log("REST API Response:");
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Error doing request:", e.message);
    }
}

testQuota();
