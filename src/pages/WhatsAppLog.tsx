import { WhatsAppDeliveryLog } from "@/components/shared/WhatsAppDeliveryLog";
import { WhatsAppConversations } from "@/components/shared/WhatsAppConversations";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function WhatsAppLog() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Delivery</h1>
        <p className="text-sm text-muted-foreground">Appointment confirmations sent to patients and whether they arrived.</p>
      </div>
      <Tabs defaultValue="delivery">
        <TabsList>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
        </TabsList>
        <TabsContent value="delivery">
          <WhatsAppDeliveryLog />
        </TabsContent>
        <TabsContent value="conversations">
          <WhatsAppConversations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
