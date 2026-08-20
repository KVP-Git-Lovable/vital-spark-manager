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

interface SalesforceToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: SalesforceToken | null = null;
let tokenExpiresAt: number = 0;

const orgUrl = import.meta.env.SALESFORCE_ORG_URL;
const clientId = import.meta.env.SALESFORCE_CLIENT_ID;
const clientSecret = import.meta.env.SALESFORCE_CLIENT_SECRET;

async function getAccessToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && tokenExpiresAt > now) {
    return cachedToken.access_token;
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await fetch(`${orgUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Salesforce auth failed: ${response.statusText}`);
    }

    cachedToken = await response.json();
    tokenExpiresAt = now + (cachedToken!.expires_in * 1000) - 60000; // Refresh 1 min early

    return cachedToken!.access_token;
  } catch (error) {
    console.error("Failed to get Salesforce access token:", error);
    throw error;
  }
}

export async function fetchSalesforceServices(): Promise<SalesforceService[]> {
  try {
    const token = await getAccessToken();

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
      throw new Error(`Failed to fetch services: ${response.statusText}`);
    }

    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error("Failed to fetch Salesforce services:", error);
    throw error;
  }
}

export async function syncServicesToSupabase(services: SalesforceService[]) {
  try {
    const supabase = (await import("@/integrations/supabase/client")).supabase;

    const servicesToInsert = services.map((sf) => {
      const recommendations = sf.Recommendations__c
        ? sf.Recommendations__c.split("\n").filter(r => r.trim())
        : [];

      return {
        name: sf.Name,
        category: sf.Category__c || "General",
        price: sf.Cost__c || 0,
        duration: sf.Duration__c || 30,
        diagnosis: sf.Diagnosis__c || null,
        procedure_notes: sf.Procedure_Notes__c || null,
        symptoms: sf.Symptoms__c || null,
        recommendations: recommendations,
        salesforce_id: sf.Id,
      };
    });

    const { data, error } = await supabase
      .from("services")
      .upsert(servicesToInsert, { onConflict: "salesforce_id" })
      .select();

    if (error) throw error;
    return data || servicesToInsert;
  } catch (error) {
    console.error("Failed to sync services to Supabase:", error);
    throw error;
  }
}
