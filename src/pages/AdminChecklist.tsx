import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface DataSource {
  county: string;
  type: string;
  url: string;
  layerId?: string;
  fields: string[];
}

interface ValidationResult {
  county: string;
  step: string;
  status: "pass" | "fail" | "pending";
  message: string;
  count?: number;
  percentage?: number;
  timestamp?: string;
}

const DATA_SOURCES: DataSource[] = [
  {
    county: "Wake",
    type: "Parcels",
    url: "https://services.wakegov.com/arcgis/rest/services/RealEstate/Parcels/FeatureServer/0",
    fields: ["PIN_NUM", "SITE_ADDRESS", "LAND_VAL", "BLDG_VAL", "TOTAL_VALUE_ASSD", "TYPE_AND_USE", "DEED_DATE", "SALE_DATE", "TOTSALPRICE", "OWNER", "REID_ACREAG", "SHAPE"]
  },
  {
    county: "Wake",
    type: "Zoning",
    url: "https://services.wakegov.com/arcgis/rest/services/Planning/Jurisdictions/FeatureServer/0",
    layerId: "0",
    fields: ["ZONE_CODE", "ZONE_DESC", "JURISDICTION", "EFFECTIVE_DATE", "SHAPE"]
  },
  {
    county: "Mecklenburg",
    type: "Parcels",
    url: "https://mcmap.org/rest/services/CountyData/Parcels/MapServer/0",
    fields: ["PARCEL_ID", "SITE_ADDR", "LAND_VALUE", "BLDG_VALUE", "TOTAL_VALUE", "USE_CODE", "DEED_DATE", "SALE_DATE", "SALE_PRICE", "OWNER_NAME", "ACREAGE", "SHAPE"]
  },
  {
    county: "Durham",
    type: "Zoning",
    url: "https://gisweb.durhamnc.gov/arcgis/rest/services/PublicServices/Planning/MapServer/12",
    layerId: "12",
    fields: ["ZONE_CODE", "ZONE_NAME", "EFFECTIVE_DATE", "SHAPE"]
  },
  {
    county: "Orange",
    type: "Zoning",
    url: "https://gis.orangecountync.gov/arcgis/rest/services/WebZoningService/MapServer/0",
    layerId: "0",
    fields: ["ZONING", "ZONE_DESC", "ADOPTED_DATE", "SHAPE"]
  },
  {
    county: "Chatham",
    type: "Parcels",
    url: "https://gis.chathamcountync.gov/arcgis/rest/services/Cadastral/Chatham_CamaParcels/MapServer/0",
    fields: ["PARCEL_ID", "OWNER_NAME", "LAND_VALUE", "BLDG_VALUE", "TOTAL_VALUE", "ACREAGE", "SHAPE"]
  },
  {
    county: "NC Statewide",
    type: "Parcels (Historic)",
    url: "https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0",
    fields: ["PIN", "LAND_VALUE", "TOTAL_VALUE", "DEED_DATE", "SHAPE"]
  }
];

const AdminChecklist = () => {
  const { toast } = useToast();
  const [validations, setValidations] = useState<ValidationResult[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = async () => {
    setIsValidating(true);
    const results: ValidationResult[] = [];

    try {
      // Check Wake ingestion
      const wakeCount = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", "wake");

      const wakeGeomCount = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", "wake")
        .not("geometry", "is", null);

      const wakeGeomPct = wakeCount.count && wakeGeomCount.count 
        ? (wakeGeomCount.count / wakeCount.count) * 100 
        : 0;

      results.push({
        county: "Wake",
        step: "Ingestion",
        status: wakeCount.count && wakeCount.count >= 400000 && wakeGeomPct >= 99 ? "pass" : "fail",
        message: `${wakeCount.count?.toLocaleString() || 0} records, ${wakeGeomPct.toFixed(1)}% with geometry`,
        count: wakeCount.count || 0,
        percentage: wakeGeomPct,
        timestamp: new Date().toISOString()
      });

      // Check Mecklenburg ingestion
      const meckCount = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", "mecklenburg");

      results.push({
        county: "Mecklenburg",
        step: "Ingestion",
        status: meckCount.count && meckCount.count > 0 ? "pass" : "pending",
        message: `${meckCount.count?.toLocaleString() || 0} records ingested`,
        count: meckCount.count || 0,
        timestamp: new Date().toISOString()
      });

      // Check YoY calculations
      const { count: yoyCount } = await supabase
        .from("parcel_scores")
        .select("*", { count: "exact", head: true })
        .not("land_value_yoy_change", "is", null);

      // Get top YoY gainers
      const { data: topGainers } = await supabase
        .from("parcel_scores")
        .select(`
          land_value_yoy_change,
          parcel_id,
          parcels!inner(pin, county, land_val)
        `)
        .not("land_value_yoy_change", "is", null)
        .order("land_value_yoy_change", { ascending: false })
        .limit(10);

      results.push({
        county: "All",
        step: "YoY Calculations",
        status: yoyCount && yoyCount > 0 ? "pass" : "fail",
        message: `${yoyCount?.toLocaleString() || 0} parcels with YoY data${topGainers && topGainers.length > 0 ? `, top gainer: ${(topGainers[0].land_value_yoy_change * 100).toFixed(1)}%` : ''}`,
        count: yoyCount || 0,
        timestamp: new Date().toISOString()
      });

      // Check zoning layers
      const { count: zoningCount } = await supabase
        .from("zoning_layers")
        .select("*", { count: "exact", head: true });

      results.push({
        county: "All",
        step: "Zoning Layers",
        status: zoningCount && zoningCount > 0 ? "pass" : "pending",
        message: `${zoningCount?.toLocaleString() || 0} zoning polygons loaded`,
        count: zoningCount || 0,
        timestamp: new Date().toISOString()
      });

      // Check scoring
      const { count: scoredCount } = await supabase
        .from("parcel_scores")
        .select("*", { count: "exact", head: true });

      const { count: wakeScored } = await supabase
        .from("parcel_scores")
        .select("*", { count: "exact", head: true })
        .eq("parcels.county", "wake");

      results.push({
        county: "All",
        step: "Scoring Complete",
        status: scoredCount && scoredCount >= 10000 ? "pass" : "pending",
        message: `${scoredCount?.toLocaleString() || 0} parcels scored`,
        count: scoredCount || 0,
        timestamp: new Date().toISOString()
      });

      setValidations(results);
      
      toast({
        title: "Validation complete",
        description: `${results.filter(r => r.status === "pass").length} of ${results.length} checks passed`,
      });
    } catch (err: any) {
      toast({
        title: "Validation error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold mb-2">Admin Checklist</h1>
          <p className="text-muted-foreground">
            Data source validation and acceptance criteria
          </p>
        </div>
        <Button onClick={runValidation} disabled={isValidating}>
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            "Revalidate"
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">A. Data Source Endpoints</h2>
          <div className="space-y-4">
            {DATA_SOURCES.map((source, idx) => (
              <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{source.county}</Badge>
                      <span className="font-semibold">{source.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {source.url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      {source.layerId && (
                        <Badge variant="secondary">Layer {source.layerId}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <strong>Fields:</strong> {source.fields.join(", ")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Validation Results</h2>
          {validations.length === 0 ? (
            <p className="text-muted-foreground">Run validation to see results</p>
          ) : (
            <div className="space-y-3">
              {validations.map((result, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    {result.status === "pass" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : result.status === "fail" ? (
                      <XCircle className="h-5 w-5 text-red-600" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {result.county} - {result.step}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {result.message}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      result.status === "pass" ? "default" :
                      result.status === "fail" ? "destructive" : "secondary"
                    }
                  >
                    {result.status.toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 bg-muted/50">
          <h3 className="font-bold text-lg mb-3">Acceptance Criteria</h3>
          <div className="space-y-2 text-sm">
            <div><strong>Wake Ingestion:</strong> ≥400,000 records, ≥99% with geometry</div>
            <div><strong>Mecklenburg Ingestion:</strong> Confirm reachable layer, non-zero count</div>
            <div><strong>YoY Calculations:</strong> Show top 10 absolute YoY gainers</div>
            <div><strong>Zoning Layers:</strong> Load Wake, Durham, Orange with zone_code, zone_desc</div>
            <div><strong>Scoring:</strong> Print AUC for Wake/Meck, ≥10k scored parcels per county</div>
            <div><strong>Vector Tiles:</strong> Tile endpoint returns data, map renders without mocks</div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminChecklist;
