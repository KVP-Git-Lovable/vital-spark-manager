import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SalesforceToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SalesforceService {
  Id: string;
  Name: string;
  Category__c?: string;
  Cost__c?: number;
  Duration__c?: number;
  Diagnosis__c?: string;
  Symptoms__c?: string;
  Procedure_Notes__c?: string;
  Medicines__c?: string;
  Recommendations__c?: string;
}

async function getAccessToken(): Promise<string> {
  const orgUrl = Deno.env.get("SALESFORCE_ORG_URL");
  const clientId = Deno.env.get("SALESFORCE_CLIENT_ID");
  const clientSecret = Deno.env.get("SALESFORCE_CLIENT_SECRET");

  if (!orgUrl || !clientId || !clientSecret) {
    throw new Error("Missing Salesforce credentials in environment variables");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(`${orgUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Salesforce auth failed: ${response.status} ${text}`);
  }

  const token: SalesforceToken = await response.json();
  return token.access_token;
}

async function fetchSalesforceServices(token: string): Promise<SalesforceService[]> {
  const orgUrl = Deno.env.get("SALESFORCE_ORG_URL");

  const query = encodeURIComponent(
    "SELECT Id, Name, Category__c, Cost__c, Duration__c, Diagnosis__c, Symptoms__c, Procedure_Notes__c, Medicines__c, Recommendations__c FROM Service__c ORDER BY Name"
  );

  const response = await fetch(
    `${orgUrl}/services/data/v57.0/query?q=${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch services: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.records || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const token = await getAccessToken();
    const services = await fetchSalesforceServices(token);

    return new Response(JSON.stringify({ success: true, services }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
