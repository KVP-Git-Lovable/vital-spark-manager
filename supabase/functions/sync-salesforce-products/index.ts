import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/salesforce";

interface SalesforceProduct {
  Id: string;
  Name: string;
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
    // Query for medicine/product data - try multiple possible object names
    const soql = `
      SELECT Id, Name,
             Generic_Name__c, Product_Family__c, Manufacturer__c,
             Unit__c, HSN_Code__c, GST_Percent__c,
             MRP__c, Selling_Price__c,
             Duration__c, Instructions__c,
             Side_Effects__c, Storage_Instructions__c,
             Reorder_Level__c
      FROM Product2
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
          generic_name: product.Generic_Name__c || null,
          category: product.Product_Family__c || "General",
          manufacturer: product.Manufacturer__c || null,
          unit: product.Unit__c || "Nos",
          hsn_code: product.HSN_Code__c || null,
          gst_percent: parseFloat(product.GST_Percent__c) || 0,
          mrp: parseFloat(product.MRP__c) || 0,
          selling_price: parseFloat(product.Selling_Price__c) || 0,
          reorder_level: parseInt(product.Reorder_Level__c) || 10,
          duration: product.Duration__c || null,
          instructions: product.Instructions__c || null,
          side_effects: product.Side_Effects__c || null,
          storage_instructions: product.Storage_Instructions__c || null,
          salesforce_id: product.Id,
        };

        // Check if product already exists
        const { data: existing, error: checkErr } = await supabase
          .from("pharma_products")
          .select("id")
          .eq("salesforce_id", product.Id)
          .single();

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
