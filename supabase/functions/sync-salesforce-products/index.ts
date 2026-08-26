import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

interface SalesforceProduct {
  Id: string;
  Name: string;
  Description: string;
  Product_Family__c: string;
  Generic_Name__c: string;
  Manufacturer__c: string;
  Unit__c: string;
  HSN_Code__c: string;
  GST_Percent__c: number;
  MRP__c: number;
  Selling_Price__c: number;
  Duration__c: string;
  Instructions__c: string;
  Side_Effects__c: string;
  Storage_Instructions__c: string;
  Reorder_Level__c: number;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch from Salesforce connector gateway (via Lovable)
    const sfResponse = await fetch(
      "https://connector-gateway.lovable.dev/salesforce/query",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `
            SELECT Id, Name, Description, Product_Family__c, Generic_Name__c,
                   Manufacturer__c, Unit__c, HSN_Code__c, GST_Percent__c,
                   MRP__c, Selling_Price__c, Duration__c, Instructions__c,
                   Side_Effects__c, Storage_Instructions__c, Reorder_Level__c
            FROM Product2
            WHERE Status__c = 'Active'
          `,
          connector: "salesforce"
        }),
      }
    );

    if (!sfResponse.ok) {
      const error = await sfResponse.text();
      throw new Error(`Salesforce API error: ${sfResponse.status} - ${error}`);
    }

    const sfData = await sfResponse.json();
    const products = sfData.records || sfData || [];

    let imported = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const {
          Id,
          Name,
          Description,
          Product_Family__c,
          Generic_Name__c,
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
        } = product as SalesforceProduct;

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
      {
        headers: { "Content-Type": "application/json" },
        status: 200
      }
    );
  } catch (err: any) {
    console.error("Salesforce sync error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Failed to sync from Salesforce",
        details: err.toString()
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
