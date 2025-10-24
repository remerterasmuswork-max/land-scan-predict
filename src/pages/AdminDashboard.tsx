import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PlayCircle, Loader2, CheckCircle2, Database, TrendingUp } from "lucide-react";

interface CountyStatus {
  name: string;
  displayName: string;
  status: "pending" | "processing" | "completed" | "error";
  totalParcels: number;
  lastIngestion?: string;
  isIngesting: boolean;
  isScoring: boolean;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const [counties, setCounties] = useState<CountyStatus[]>([
    { name: "wake", displayName: "Wake County", status: "pending", totalParcels: 0, isIngesting: false, isScoring: false },
    { name: "mecklenburg", displayName: "Mecklenburg County", status: "pending", totalParcels: 0, isIngesting: false, isScoring: false },
    { name: "durham", displayName: "Durham County", status: "pending", totalParcels: 0, isIngesting: false, isScoring: false },
    { name: "orange", displayName: "Orange County", status: "pending", totalParcels: 0, isIngesting: false, isScoring: false },
    { name: "chatham", displayName: "Chatham County", status: "pending", totalParcels: 0, isIngesting: false, isScoring: false },
  ]);

  const handleIngest = async (countyName: string) => {
    setCounties(prev => prev.map(c => 
      c.name === countyName ? { ...c, isIngesting: true, status: "processing" as const } : c
    ));

    toast({
      title: `Ingesting ${countyName} county...`,
      description: "This may take a few minutes",
    });

    try {
      const { data, error } = await supabase.functions.invoke("ingest-county", {
        body: { county: countyName },
      });

      if (error) throw error;

      toast({
        title: "Ingestion complete!",
        description: `${data.processed} parcels ingested, ${data.withGeometry} with geometry`,
      });

      setCounties(prev => prev.map(c => 
        c.name === countyName 
          ? { ...c, isIngesting: false, status: "completed", totalParcels: data.processed, lastIngestion: new Date().toISOString() }
          : c
      ));
    } catch (err: any) {
      toast({
        title: "Ingestion failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });

      setCounties(prev => prev.map(c => 
        c.name === countyName ? { ...c, isIngesting: false, status: "error" as const } : c
      ));
    }
  };

  const handleScore = async (countyName: string) => {
    setCounties(prev => prev.map(c => 
      c.name === countyName ? { ...c, isScoring: true } : c
    ));

    toast({
      title: `Scoring ${countyName} county...`,
      description: "Computing investment scores and rezoning probabilities",
    });

    try {
      const { data, error } = await supabase.functions.invoke("score-county", {
        body: { county: countyName },
      });

      if (error) throw error;

      toast({
        title: "Scoring complete!",
        description: `${data.scored} parcels scored (AUC: ${data.auc.toFixed(2)})`,
      });

      setCounties(prev => prev.map(c => 
        c.name === countyName ? { ...c, isScoring: false } : c
      ));
    } catch (err: any) {
      toast({
        title: "Scoring failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });

      setCounties(prev => prev.map(c => 
        c.name === countyName ? { ...c, isScoring: false } : c
      ));
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Data ingestion and scoring controls for NC counties
        </p>
      </div>

      <div className="grid gap-4">
        {counties.map((county) => (
          <Card key={county.name} className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold">{county.displayName}</h3>
                  <Badge 
                    variant={
                      county.status === "completed" ? "default" :
                      county.status === "processing" ? "secondary" :
                      county.status === "error" ? "destructive" : "outline"
                    }
                  >
                    {county.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    <span>{county.totalParcels.toLocaleString()} parcels</span>
                  </div>
                  {county.lastIngestion && (
                    <div>
                      Last ingested: {new Date(county.lastIngestion).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => handleIngest(county.name)}
                  disabled={county.isIngesting || county.isScoring}
                  variant="outline"
                  size="sm"
                >
                  {county.isIngesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ingesting...
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      Ingest
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleScore(county.name)}
                  disabled={county.isScoring || county.isIngesting || county.totalParcels === 0}
                  size="sm"
                >
                  {county.isScoring ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Scoring...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Score
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-6 bg-muted/50">
        <h3 className="font-bold text-lg mb-3">Workflow Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Click <strong>Ingest</strong> for each county to pull parcel data from county GIS servers</li>
          <li>Wait for ingestion to complete (typically 1-3 minutes per county)</li>
          <li>Click <strong>Score</strong> to run the upzoning prediction model on ingested parcels</li>
          <li>View results on the main dashboard and map</li>
        </ol>
        <div className="mt-4 p-3 bg-background rounded border">
          <p className="text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 inline mr-1 text-success" />
            Data sources: Wake, Mecklenburg (county servers), Durham, Orange, Chatham (NC OneMap)
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AdminDashboard;
