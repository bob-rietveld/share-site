// share-site-worker: Multi-tenant deployment backend for Cloudflare Pages
// Deploy this worker once, then anyone with the CLI can deploy sites to your account

export default {
  async fetch(request, env) {
    // CORS headers for CLI access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Project-Name, X-Password, X-Emails, X-Domain',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST required' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      // Get config from headers
      const projectName = request.headers.get('X-Project-Name') || `site-${Date.now().toString().slice(-6)}`;
      const password = request.headers.get('X-Password') || '';
      const emails = request.headers.get('X-Emails') || '';
      const domain = request.headers.get('X-Domain') || '';

      // Get the uploaded zip file
      const zipBuffer = await request.arrayBuffer();
      
      if (!zipBuffer || zipBuffer.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'No file uploaded' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Deploy to Cloudflare Pages via API
      const formData = new FormData();
      formData.append('file', new Blob([zipBuffer], { type: 'application/zip' }));

      // Create or update the Pages project
      const deployResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
          },
          body: formData
        }
      );

      let deployResult = await deployResponse.json();

      // If project doesn't exist, create it first
      if (!deployResponse.ok && deployResult.errors?.[0]?.code === 8000007) {
        // Create project
        const createResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: projectName,
              production_branch: 'main'
            })
          }
        );

        if (!createResponse.ok) {
          const createError = await createResponse.json();
          return new Response(JSON.stringify({ 
            error: 'Failed to create project', 
            details: createError 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Retry deployment
        const retryResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            },
            body: formData
          }
        );

        deployResult = await retryResponse.json();
        
        if (!retryResponse.ok) {
          return new Response(JSON.stringify({ 
            error: 'Deployment failed', 
            details: deployResult 
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else if (!deployResponse.ok) {
        return new Response(JSON.stringify({ 
          error: 'Deployment failed', 
          details: deployResult 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const url = `https://${projectName}.pages.dev`;
      
      // Set up Cloudflare Access if emails/domain specified
      let accessSetup = null;
      if (emails || domain) {
        accessSetup = await setupAccess(env, projectName, emails, domain);
      }

      return new Response(JSON.stringify({
        success: true,
        url: url,
        project: projectName,
        deployment: deployResult.result,
        access: accessSetup,
        protection: {
          password: password ? true : false,
          emails: emails || null,
          domain: domain || null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal error', 
        message: error.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Set up Cloudflare Access for email-based auth
async function setupAccess(env, projectName, emails, domain) {
  const appDomain = `${projectName}.pages.dev`;
  
  // Build include rules
  const include = [];
  
  if (emails) {
    const emailList = emails.split(',').map(e => e.trim());
    for (const email of emailList) {
      include.push({ email: { email: email } });
    }
  }
  
  if (domain) {
    const cleanDomain = domain.replace(/^@/, '');
    include.push({ email_domain: { domain: cleanDomain } });
  }

  // Check if app already exists
  const listResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps`,
    {
      headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
    }
  );
  
  const listResult = await listResponse.json();
  const existingApp = listResult.result?.find(app => 
    app.domain === appDomain || app.name === projectName
  );

  if (existingApp) {
    // Update existing app's policy
    // First get existing policies
    const policiesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${existingApp.id}/policies`,
      {
        headers: { 'Authorization': `Bearer ${env.CF_API_TOKEN}` }
      }
    );
    
    const policiesResult = await policiesResponse.json();
    const existingPolicy = policiesResult.result?.[0];

    if (existingPolicy) {
      // Update policy
      await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${existingApp.id}/policies/${existingPolicy.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${env.CF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Allowed Users',
            decision: 'allow',
            include: include
          })
        }
      );
    }

    return { status: 'updated', appId: existingApp.id };
  }

  // Create new Access application
  const createAppResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectName,
        domain: appDomain,
        type: 'self_hosted',
        session_duration: '24h',
        auto_redirect_to_identity: false
      })
    }
  );

  const appResult = await createAppResponse.json();
  
  if (!createAppResponse.ok) {
    return { status: 'failed', error: appResult };
  }

  const appId = appResult.result.id;

  // Create access policy
  const createPolicyResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/apps/${appId}/policies`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Allowed Users',
        decision: 'allow',
        include: include
      })
    }
  );

  const policyResult = await createPolicyResponse.json();

  if (!createPolicyResponse.ok) {
    return { status: 'partial', appId: appId, policyError: policyResult };
  }

  return { status: 'created', appId: appId };
}
