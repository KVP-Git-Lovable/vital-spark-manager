import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/salesforce";

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

async function fetchSalesforceServices(): Promise<SalesforceService[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const salesforceApiKey = Deno.env.get("SALESFORCE_API_KEY");

  if (!lovableApiKey || !salesforceApiKey) {
    throw new Error("Salesforce connector secrets are not configured");
  }

  const soql =
    "SELECT Id, Name, Category__c, Cost__c, Duration__c, Diagnosis__c, Symptoms__c, Procedure_Notes__c, Medicines__c, Recommendations__c FROM Service__c ORDER BY Name";

  const response = await fetch(`${GATEWAY_URL}/query?q=${encodeURIComponent(soql)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": salesforceApiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Salesforce gateway request failed [${response.status}]: ${errorBody}`);
    throw new Error(`[${response.status}] ${errorBody}`);
  }

  const data = await response.json();
  return data.records || [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const services = await fetchSalesforceServices();

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
