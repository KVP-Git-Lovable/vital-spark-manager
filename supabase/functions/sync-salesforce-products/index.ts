import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/salesforce";

interface SalesforceProduct {
  Id: string;
  Name: string;
  Generic_Name__c?: string | null;
  Product_Family__c?: string | null;
  Manufacturer__c?: string | null;
  Unit__c?: string | null;
  HSN_Code__c?: string | null;
  GST_Percent__c?: number | null;
  MRP__c?: number | null;
  Selling_Price__c?: number | null;
  Duration__c?: string | null;
  Instructions__c?: string | null;
  Side_Effects__c?: string | null;
  Storage_Instructions__c?: string | null;
  Reorder_Level__c?: number | null;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const salesforceApiKey = Deno.env.get("SALESFORCE_API_KEY") || "";

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // SOQL query for active products with all required fields
    const soql = `
      SELECT Id, Name, Generic_Name__c, Product_Family__c, Manufacturer__c,
             Unit__c, HSN_Code__c, GST_Percent__c, MRP__c, Selling_Price__c,
             Duration__c, Instructions__c, Side_Effects__c, Storage_Instructions__c,
             Reorder_Level__c
      FROM Product2
      WHERE IsActive = true
    `;

    const sfResponse = await fetch(
      `${GATEWAY_URL}/query?q=${encodeURIComponent(soql)}`,
      {
        method: "GET",
        headers: {
          Authorization: lovableApiKey ? `Bearer ${lovableApiKey}` : "",
          "X-Connection-Api-Key": salesforceApiKey,
          Accept: "application/json",
        },
      }
    );

    if (!sfResponse.ok) {
      const errorBody = await sfResponse.text();
      console.error(`Salesforce gateway error [${sfResponse.status}]: ${errorBody}`);
      throw new Error(`Salesforce API error: ${sfResponse.status}`);
    }

    const data = await sfResponse.json();
    const products: SalesforceProduct[] = data.records || [];

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const {
          Id,
          Name,
          Generic_Name__c,
          Product_Family__c,
          Manufacturer__c,
          Unit__c,
          HSN_Code__c,
          GST_Percent__c,
          MRP__c,
          Selling_Price__c,
          Duration__c,
          Instructions__c,
          Side_Effects__c,
          Storage_Instructions__c,
          Reorder_Level__c,
        } = product;

        // Check if product already exists
        const { data: existing } = await supabase
          .from("pharma_products")
          .select("id")
          .eq("salesforce_id", Id)
          .single();

        const payload = {
          name: Name,
          generic_name: Generic_Name__c || null,
          category: Product_Family__c || "General",
          manufacturer: Manufacturer__c || null,
          unit: Unit__c || "Nos",
          hsn_code: HSN_Code__c || null,
          gst_percent: GST_Percent__c || 0,
          mrp: MRP__c || 0,
          selling_price: Selling_Price__c || 0,
          reorder_level: Reorder_Level__c || 10,
          duration: Duration__c || null,
          instructions: Instructions__c || null,
          side_effects: Side_Effects__c || null,
          storage_instructions: Storage_Instructions__c || null,
          salesforce_id: Id,
        };

        if (existing) {
          // Update existing
          const { error: updateErr } = await supabase
            .from("pharma_products")
            .update(payload)
            .eq("id", existing.id);
          if (updateErr) throw updateErr;
          updated++;
        } else {
          // Insert new
          const { error: insertErr } = await supabase
            .from("pharma_products")
            .insert(payload);
          if (insertErr) throw insertErr;
          imported++;
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
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("Salesforce product sync error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Failed to sync from Salesforce",
      }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
