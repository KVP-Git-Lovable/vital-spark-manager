import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/salesforce";

interface SalesforceProduct {
  Id: string;
  Name: string;
  Description?: string | null;
  Family?: string | null;
  IsActive?: boolean | null;
  QuantityUnitOfMeasure?: string | null;
  StockKeepingUnit?: string | null;
  [key: string]: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const salesforceApiKey = Deno.env.get("SALESFORCE_API_KEY");

  if (!supabaseUrl || !supabaseKey || !lovableApiKey || !salesforceApiKey) {
    console.error("Missing required product sync environment variables", {
      supabaseUrl: Boolean(supabaseUrl),
      supabaseKey: Boolean(supabaseKey),
      lovableApiKey: Boolean(lovableApiKey),
      salesforceApiKey: Boolean(salesforceApiKey),
    });
    return new Response(
      JSON.stringify({ success: false, error: "Product sync is not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Query only fields available on Product2 in the connected clinic org.
    const soql = `
      SELECT Id, Name, Description, Family, IsActive,
             QuantityUnitOfMeasure, StockKeepingUnit
      FROM Product2
      WHERE IsActive = true
      LIMIT 1000
    `;

    console.log("Executing SOQL query:", soql);

    const sfResponse = await fetch(
      `${GATEWAY_URL}/query?q=${encodeURIComponent(soql)}`,
      {
        method: "GET",
        headers: {
           "Authorization": `Bearer ${lovableApiKey}`,
           "X-Connection-Api-Key": salesforceApiKey,
          "Accept": "application/json",
        },
      }
    );

    console.log("Salesforce response status:", sfResponse.status);

    if (!sfResponse.ok) {
      const errorBody = await sfResponse.text();
      console.error(`Salesforce error [${sfResponse.status}]:`, errorBody);
      throw new Error(`Salesforce error ${sfResponse.status}: ${errorBody}`);
    }

    const data = await sfResponse.json();
    console.log("Salesforce data received:", JSON.stringify(data).substring(0, 500));

    const products: SalesforceProduct[] = data.records || data || [];
    console.log(`Found ${products.length} products`);

    if (products.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          imported: 0,
          updated: 0,
          total: 0,
          message: "No products found in Salesforce",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const payload = {
          name: product.Name,
          generic_name: null,
          category: product.Family || "General",
          manufacturer: null,
          unit: product.QuantityUnitOfMeasure || "Nos",
          hsn_code: product.StockKeepingUnit || null,
          gst_percent: 0,
          mrp: 0,
          selling_price: 0,
          reorder_level: 10,
          default_instructions: product.Description || null,
        };

        // The live pharmacy table does not yet contain salesforce_id, so match
        // on the exact Salesforce product name to keep repeat syncs idempotent.
        const { data: existing, error: checkErr } = await supabase
          .from("pharma_products")
          .select("id")
          .eq("name", product.Name)
          .maybeSingle();

        if (checkErr) {
          errors.push(`${product.Name}: Lookup failed - ${checkErr.message}`);
          continue;
        }

        if (existing) {
          // Update existing
          const { error: updateErr } = await supabase
            .from("pharma_products")
            .update(payload)
            .eq("id", existing.id);
          if (updateErr) {
            errors.push(`${product.Name}: Update failed - ${updateErr.message}`);
          } else {
            updated++;
          }
        } else {
          // Insert new
          const { error: insertErr } = await supabase
            .from("pharma_products")
            .insert(payload);
          if (insertErr) {
            errors.push(`${product.Name}: Insert failed - ${insertErr.message}`);
          } else {
            imported++;
          }
        }
      } catch (err: any) {
        errors.push(`${product.Name}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        updated,
        total: products.length,
        errors: errors.length > 0 ? errors : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("Product sync error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Failed to sync products",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
