import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/salesforce";

// Actual fields available on Service__c in the connected org
interface SalesforceServiceRaw {
  Id: string;
  Name: string;
  Product_Family__c?: string | null;
  Total_amount__c?: number | null;
  Diagnosis__c?: string | null;
  Symptoms__c?: string | null;
  Special_Instructions__c?: string | null;
  Prescription__c?: string | null;
  Dietary_Advice__c?: string | null;
  Product_Discription__c?: string | null;
  isActive__c?: boolean | null;
}

// Shape consumed by the app
interface SalesforceService {
  Id: string;
  Name: string;
  Category__c: string | null;
  Cost__c: number | null;
  Duration__c: number | null;
  Diagnosis__c: string | null;
  Symptoms__c: string | null;
  Procedure_Notes__c: string | null;
  Medicines__c: string | null;
  Recommendations__c: string | null;
}

async function fetchSalesforceServices(): Promise<SalesforceService[]> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const salesforceApiKey = Deno.env.get("SALESFORCE_API_KEY");

  if (!lovableApiKey || !salesforceApiKey) {
    throw new Error("Salesforce connector secrets are not configured");
  }

  const soql =
    "SELECT Id, Name, Product_Family__c, Total_amount__c, Diagnosis__c, Symptoms__c, Special_Instructions__c, Prescription__c, Dietary_Advice__c, Product_Discription__c, isActive__c FROM Service__c ORDER BY Name";

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
  const records: SalesforceServiceRaw[] = data.records || [];

  return records.map((r) => ({
    Id: r.Id,
    Name: r.Name,
    Category__c: r.Product_Family__c ?? null,
    Cost__c: r.Total_amount__c ?? null,
    Duration__c: null,
    Diagnosis__c: r.Diagnosis__c ?? null,
    Symptoms__c: r.Symptoms__c ?? null,
    Procedure_Notes__c: r.Special_Instructions__c ?? r.Product_Discription__c ?? null,
    Medicines__c: r.Prescription__c ?? null,
    Recommendations__c: r.Dietary_Advice__c ?? null,
  }));
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
