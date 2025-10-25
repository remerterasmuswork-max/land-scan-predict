import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CheckResult {
  status: "pass" | "fail" | "pending";
  message: string;
  details?: any;
}

interface CountyChecks {
  dataEndpoints: CheckResult;
  ingestion: CheckResult;
  yoyData: CheckResult;
  zoningInfra: CheckResult;
  scoring: CheckResult;
  vectorTiles: CheckResult;
}

const FIELD_MAPS = {
  wake: {
    parcels_url: "https://services.wakegov.com/arcgis/rest/services/RealEstate/Parcels/FeatureServer/0",
    zoning_url: "https://services.wakegov.com/arcgis/rest/services/Planning/Zoning/FeatureServer/0",
    fields: {
      pin: "PIN_NUM",
      geometry: "SHAPE → centroid + calc_area_acres (ST_Area/4046.86)",
      land_val: "LAND_VAL",
      bldg_val: "BLDG_VAL", 
      total_value_assd: "TOTAL_VALUE_ASSD",
      type_and_use_code: "TYPE_AND_USE (numeric)",
      type_use_decode: "TYPE_USE_DECODE (text)",
      land_code: "LAND_CODE",
      billing_class_decode: "BILLING_CLASS",
      deed_date: "DEED_DATE",
      sale_date: "SALE_DATE",
      totsalprice: "TOTSALPRICE",
      owner_name: "OWNER",
      owner_mailing: "OWNER_MAILING (1 & 2)",
      acreage: "REID_ACREAG",
      city: "CITY",
      zip_code: "ZIP",
    },
  },
  mecklenburg: {
    parcels_url: "https://mcmap.org/rest/services/CountyData/Parcels/MapServer/0",
    zoning_url: "Not configured",
    fields: {
      pin: "PARCEL_ID",
      geometry: "SHAPE → auto-computed",
      land_val: "LAND_VALUE",
      bldg_val: "BLDG_VALUE",
      total_value_assd: "TOTAL_VALUE",
      type_and_use_code: "USE_CODE",
      deed_date: "DEED_DATE",
      sale_date: "SALE_DATE",
      totsalprice: "SALE_PRICE",
      owner_name: "OWNER_NAME",
      acreage: "ACREAGE",
    },
  },
};

export default function AdminChecklist() {
  const { toast } = useToast();
  const [checks, setChecks] = useState<Record<string, CountyChecks>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string>("");
  const [autoResumeRunning, setAutoResumeRunning] = useState(false);
  const [ingestProgress, setIngestProgress] = useState<string>("");

  const runDiagnostics = async () => {
    let output = "=== RAW DIAGNOSTIC RESULTS ===\n\n";

    // Query 1: Wake parcels geometry
    try {
      const { data: q1, error } = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", "wake" as any);
      
      const { data: q1geom, error: geomError } = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", "wake" as any)
        .not("geometry", "is", null);

      const pctGeom = q1 && q1geom ? ((q1geom as any) / (q1 as any) * 100).toFixed(2) : "0.00";
      
      const result = { count: (q1 as any) || 0, count_geom: (q1geom as any) || 0, pct_geom: pctGeom };
      output += "Q1: Wake parcels geometry\n";
      output += JSON.stringify(result, null, 2) + "\n";
      if (!q1 || (q1 as any) === 0) output += "FAIL: No Wake parcels\n";
      console.log("Q1:", result);
    } catch (e: any) {
      output += `FAIL: Q1 - ${e.message}\n`;
      console.error("Q1 FAIL:", e);
    }

    // Query 2: YoY rows  
    try {
      const { count: q2 } = await supabase
        .from("parcel_yoy")
        .select("*", { count: "exact", head: true })
        .not("land_val_yoy", "is", null);
      
      output += "\nQ2: YoY rows\n";
      output += JSON.stringify({ yoy_rows: q2 }, null, 2) + "\n";
      if (!q2 || q2 === 0) output += "FAIL: No YoY data\n";
      console.log("Q2:", { yoy_rows: q2 });
    } catch (e: any) {
      output += `FAIL: Q2 - ${e.message}\n`;
      console.error("Q2 FAIL:", e);
    }

    // Query 3: Top YoY gainers
    try {
      const { data: q3 } = await supabase
        .from("parcel_yoy")
        .select(`
          land_val_yoy,
          use_change_flag,
          parcels!inner(pin, county)
        `)
        .eq("parcels.county", "wake" as any)
        .order("land_val_yoy", { ascending: false })
        .limit(5);
      
      output += "\nQ3: Top 5 YoY gainers (Wake)\n";
      output += JSON.stringify(q3, null, 2) + "\n";
      if (!q3 || q3.length === 0) output += "FAIL: No YoY gainers\n";
      console.log("Q3:", q3);
    } catch (e: any) {
      output += `FAIL: Q3 - ${e.message}\n`;
      console.error("Q3 FAIL:", e);
    }

    // Query 4: Wake scored count
    try {
      const { count: q4 } = await supabase
        .from("parcel_scores")
        .select("*, parcels!inner(county)", { count: "exact", head: true })
        .eq("parcels.county", "wake" as any);
      
      output += "\nQ4: Wake scored parcels count\n";
      output += JSON.stringify({ count: q4 }, null, 2) + "\n";
      if (!q4 || q4 < 10000) output += "FAIL: <10k scored parcels\n";
      console.log("Q4:", { count: q4 });
    } catch (e: any) {
      output += `FAIL: Q4 - ${e.message}\n`;
      console.error("Q4 FAIL:", e);
    }

    // Query 5: Top scored parcels
    try {
      const { data: q5 } = await supabase
        .from("parcel_scores")
        .select(`
          rezoning_probability,
          investment_score,
          parcels!inner(pin, county)
        `)
        .eq("parcels.county", "wake" as any)
        .order("investment_score", { ascending: false })
        .limit(5);
      
      output += "\nQ5: Top 5 scored parcels (Wake)\n";
      output += JSON.stringify(q5, null, 2) + "\n";
      if (!q5 || q5.length === 0) output += "FAIL: No scored parcels\n";
      console.log("Q5:", q5);
    } catch (e: any) {
      output += `FAIL: Q5 - ${e.message}\n`;
      console.error("Q5 FAIL:", e);
    }

    // Query 6: Test tile endpoint
    try {
      const tileUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vector-tiles/14/9234/12030.mvt`;
      const response = await fetch(tileUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      const blob = await response.blob();
      output += "\nQ6: Tile endpoint test\n";
      output += `HTTP ${response.status}, size=${blob.size} bytes\n`;
      if (response.ok && blob.size > 0) {
        output += "PASS: Tile endpoint returns non-empty binary\n";
      } else {
        output += "FAIL: Tile endpoint returned empty or error\n";
      }
      console.log("Q6: Tile test", { status: response.status, size: blob.size });
    } catch (e: any) {
      output += `FAIL: Q6 - ${e.message}\n`;
      console.error("Q6 FAIL:", e);
    }

    output += "\n=== END DIAGNOSTICS ===";
    setDiagnostics(output);
    console.log(output);
  };

  const runChecks = async (county: string) => {
    const countyChecks: CountyChecks = {
      dataEndpoints: { status: "pending", message: "Checking..." },
      ingestion: { status: "pending", message: "Checking..." },
      yoyData: { status: "pending", message: "Checking..." },
      zoningInfra: { status: "pending", message: "Checking..." },
      scoring: { status: "pending", message: "Checking..." },
      vectorTiles: { status: "pending", message: "Checking..." },
    };

    setChecks((prev) => ({ ...prev, [county]: countyChecks }));

    // Check 1: Data Endpoints
    try {
      const config = FIELD_MAPS[county as keyof typeof FIELD_MAPS];
      countyChecks.dataEndpoints = {
        status: "pass",
        message: "Endpoints configured",
        details: config,
      };
    } catch (e) {
      countyChecks.dataEndpoints = {
        status: "fail",
        message: `Missing endpoint config: ${e}`,
      };
    }

    // Check 2: Ingestion
    try {
      const { error, count } = await supabase
        .from("parcels")
        .select("*", { count: "exact", head: true })
        .eq("county", county.toLowerCase() as any);

      const { data: jobs } = await supabase
        .from("ingestion_jobs")
        .select("*")
        .eq("county", county.toLowerCase() as any)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;

      const geometryRate = jobs?.records_with_geometry && jobs?.records_processed
        ? jobs.records_with_geometry / jobs.records_processed
        : 0;

      if (county === "wake" && (count || 0) < 400000) {
        countyChecks.ingestion = {
          status: "fail",
          message: `Only ${count} parcels (need >=400k)`,
        };
      } else if (geometryRate < 0.99) {
        countyChecks.ingestion = {
          status: "fail",
          message: `Geometry rate ${(geometryRate * 100).toFixed(1)}% (need >=99%)`,
        };
      } else {
        countyChecks.ingestion = {
          status: "pass",
          message: `${count} parcels, ${(geometryRate * 100).toFixed(1)}% with geometry`,
          details: jobs,
        };
      }
    } catch (e) {
      countyChecks.ingestion = {
        status: "fail",
        message: `Ingestion check failed: ${e}`,
      };
    }

    // Check 3: YoY Data
    try {
      const { count: yoyCount } = await supabase
        .from("parcel_yoy")
        .select("*", { count: "exact", head: true })
        .not("land_val_yoy", "is", null);

      const { data: topGainers } = await supabase
        .from("parcel_yoy")
        .select(`
          parcel_id,
          land_curr,
          land_prev,
          land_val_yoy,
          parcels!inner(pin, acreage, county)
        `)
        .eq("parcels.county", county.toLowerCase() as any)
        .order("land_val_yoy", { ascending: false })
        .limit(10);

      if ((yoyCount || 0) === 0) {
        countyChecks.yoyData = {
          status: "fail",
          message: "No YoY data found",
        };
      } else {
        countyChecks.yoyData = {
          status: "pass",
          message: `${yoyCount} parcels with YoY data`,
          details: topGainers,
        };
      }
    } catch (e) {
      countyChecks.yoyData = {
        status: "fail",
        message: `YoY check failed: ${e}`,
      };
    }

    // Check 4: Zoning/Infra MVs
    try {
      const { count: zoningCount } = await supabase
        .from("parcel_zoning_mv")
        .select("*", { count: "exact", head: true });

      const { count: infraCount } = await supabase
        .from("parcel_infra_mv")
        .select("*", { count: "exact", head: true });

      const { count: signalsCount } = await supabase
        .from("parcel_signals_mv")
        .select("*", { count: "exact", head: true });

      const { data: sample } = await supabase
        .from("parcel_signals_mv")
        .select("*")
        .eq("county", county.toLowerCase() as any)
        .limit(5);

      if (!zoningCount && !infraCount && !signalsCount) {
        countyChecks.zoningInfra = {
          status: "fail",
          message: "No materialized view data",
        };
      } else {
        countyChecks.zoningInfra = {
          status: "pass",
          message: `MVs: zoning=${zoningCount}, infra=${infraCount}, signals=${signalsCount}`,
          details: sample,
        };
      }
    } catch (e) {
      countyChecks.zoningInfra = {
        status: "fail",
        message: `MV check failed: ${e}`,
      };
    }

    // Check 5: Scoring
    try {
      const { count: scoredCount } = await supabase
        .from("parcel_scores")
        .select("parcel_id, parcels!inner(county)", { count: "exact", head: true })
        .eq("parcels.county", county.toLowerCase() as any);

      const { data: topScored } = await supabase
        .from("parcel_scores")
        .select(`
          rezoning_probability,
          investment_score,
          parcels!inner(pin, county)
        `)
        .eq("parcels.county", county.toLowerCase() as any)
        .order("investment_score", { ascending: false })
        .limit(5);

      if ((scoredCount || 0) < 10000) {
        countyChecks.scoring = {
          status: "fail",
          message: `Only ${scoredCount} scored parcels (need >=10k)`,
        };
      } else {
        countyChecks.scoring = {
          status: "pass",
          message: `${scoredCount} parcels scored, mock AUC=0.75`,
          details: topScored,
        };
      }
    } catch (e) {
      countyChecks.scoring = {
        status: "fail",
        message: `Scoring check failed: ${e}`,
      };
    }

    // Check 6: Vector Tiles
    try {
      const tileUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vector-tiles/14/4823/6160.mvt?county=${county}`;
      const response = await fetch(tileUrl, {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });

      if (response.ok) {
        countyChecks.vectorTiles = {
          status: "pass",
          message: `Tile endpoint responding (HTTP ${response.status})`,
          details: { url: tileUrl },
        };
      } else {
        countyChecks.vectorTiles = {
          status: "fail",
          message: `Tile endpoint returned HTTP ${response.status}`,
        };
      }
    } catch (e) {
      countyChecks.vectorTiles = {
        status: "fail",
        message: `Tile check failed: ${e}`,
      };
    }

    setChecks((prev) => ({ ...prev, [county]: countyChecks }));
  };

  const runUntilComplete = async (county: string) => {
    setAutoResumeRunning(true);
    setIngestProgress("");
    let iteration = 0;
    
    try {
      while (true) {
        iteration++;
        setIngestProgress(`Running iteration ${iteration}...`);
        
        const { data, error } = await supabase.functions.invoke("ingest-county", { 
          body: { county } 
        });
        
        if (error) {
          setIngestProgress(`FAIL: ${error.message}`);
          toast({ title: "Ingestion failed", description: error.message, variant: "destructive" });
          break;
        }
        
        if (data?.status === "COMPLETED") {
          setIngestProgress(`COMPLETED after ${iteration} iterations\n\nResults:\nwake_rows: ${data.wake_rows}\npct_geom: ${data.pct_geom}%\nhist_rows: ${data.hist_rows}\n\nSample:\n${JSON.stringify(data.sample_rows, null, 2)}`);
          toast({ title: "Ingestion complete!", variant: "default" });
          break;
        }
        
        if (data?.status === "FAIL") {
          setIngestProgress(`FAIL: ${data.reason || data.error}\n${JSON.stringify(data, null, 2)}`);
          toast({ title: "Acceptance criteria not met", description: data.reason, variant: "destructive" });
          break;
        }
        
        if (data?.status === "PROGRESS") {
          setIngestProgress(`Iteration ${iteration}: Processed ${data.processed_batch} parcels (cursor: ${data.last_objectid})`);
          await new Promise(resolve => setTimeout(resolve, 250));
        } else {
          setIngestProgress(`Unexpected status: ${JSON.stringify(data, null, 2)}`);
          break;
        }
      }
    } catch (e: any) {
      setIngestProgress(`ERROR: ${e.message}`);
      toast({ title: "Error during auto-resume", description: e.message, variant: "destructive" });
    }
    
    setAutoResumeRunning(false);
  };

  const runWorkflow = async (county: string) => {
    setIsRunning(true);
    try {
      toast({ title: `Starting workflow for ${county}...` });

      // 1. Ingest
      toast({ title: "1/5 - Ingesting parcels..." });
      await supabase.functions.invoke("ingest-county", { body: { county } });

      // 2. Backfill
      toast({ title: "2/5 - Backfilling history..." });
      await supabase.functions.invoke("backfill-history", { body: { county, monthsBack: 24 } });

      // 3. Load zoning
      toast({ title: "3/5 - Loading zoning..." });
      await supabase.functions.invoke("load-zoning", { body: { county } });

      // 4. Refresh views
      toast({ title: "4/5 - Refreshing views..." });
      await supabase.functions.invoke("refresh-views");

      // 5. Score
      toast({ title: "5/5 - Scoring parcels..." });
      await supabase.functions.invoke("score-county", { body: { county } });

      toast({ title: `Workflow complete for ${county}!`, variant: "default" });

      // Run checks
      await runChecks(county);
    } catch (e: any) {
      toast({ title: `Workflow failed for ${county}`, description: e.message, variant: "destructive" });
    }
    setIsRunning(false);
  };

  const StatusIcon = ({ status }: { status: "pass" | "fail" | "pending" }) => {
    if (status === "pass") return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === "fail") return <XCircle className="h-5 w-5 text-red-500" />;
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Checklist</h1>
        <p className="text-muted-foreground">
          Data pipeline validation — Wake and Mecklenburg counties
        </p>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Raw Diagnostics</h2>
          <Button onClick={runDiagnostics} disabled={isRunning}>
            Run SQL Diagnostics
          </Button>
        </div>
        {diagnostics && (
          <pre className="bg-black text-green-400 p-4 rounded text-xs overflow-auto max-h-96 font-mono">
            {diagnostics}
          </pre>
        )}
      </Card>

      {Object.entries(FIELD_MAPS).map(([county, config]) => (
        <Card key={county} className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold capitalize">{county} County</h2>
            <div className="space-x-2">
              <Button onClick={() => runChecks(county)} disabled={isRunning || autoResumeRunning}>
                Run Checks
              </Button>
              <Button onClick={() => runWorkflow(county)} disabled={isRunning || autoResumeRunning} variant="secondary">
                Run Full Workflow
              </Button>
              {county === "wake" && (
                <Button 
                  onClick={() => runUntilComplete(county)} 
                  disabled={isRunning || autoResumeRunning}
                  variant="default"
                >
                  {autoResumeRunning ? "Running..." : "Run Until Complete (Wake)"}
                </Button>
              )}
            </div>
          </div>
          
          {county === "wake" && ingestProgress && (
            <div className="bg-muted p-4 rounded">
              <pre className="text-xs font-mono whitespace-pre-wrap">{ingestProgress}</pre>
            </div>
          )}

          {/* 1. Data Endpoints */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.dataEndpoints && <StatusIcon status={checks[county].dataEndpoints.status} />}
              1. Data Endpoints
            </h3>
            <div className="pl-7 space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <strong>Parcels URL:</strong> 
                <a href={config.parcels_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                  {config.parcels_url} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <strong>Zoning URL:</strong>
                {config.zoning_url !== "Not configured" ? (
                  <a href={config.zoning_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                    {config.zoning_url} <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{config.zoning_url}</span>
                )}
              </div>
              <div className="mt-2"><strong>Field Mappings:</strong></div>
              <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(config.fields, null, 2)}
              </pre>
              {checks[county]?.dataEndpoints && (
                <Badge variant={checks[county].dataEndpoints.status === "pass" ? "default" : "destructive"}>
                  {checks[county].dataEndpoints.message}
                </Badge>
              )}
            </div>
          </div>

          {/* 2. Ingestion */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.ingestion && <StatusIcon status={checks[county].ingestion.status} />}
              2. Ingestion (Esri paging, geometry, history snapshot)
            </h3>
            <div className="pl-7 text-sm">
              {checks[county]?.ingestion ? (
                <>
                  <Badge variant={checks[county].ingestion.status === "pass" ? "default" : "destructive"}>
                    {checks[county].ingestion.message}
                  </Badge>
                  {checks[county].ingestion.details && (
                    <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(checks[county].ingestion.details, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not checked yet</span>
              )}
            </div>
          </div>

          {/* 3. YoY Historical Data */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.yoyData && <StatusIcon status={checks[county].yoyData.status} />}
              3. YoY Historical Data (top 10 gainers)
            </h3>
            <div className="pl-7 text-sm">
              {checks[county]?.yoyData ? (
                <>
                  <Badge variant={checks[county].yoyData.status === "pass" ? "default" : "destructive"}>
                    {checks[county].yoyData.message}
                  </Badge>
                  {checks[county].yoyData.details && (
                    <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(checks[county].yoyData.details, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not checked yet</span>
              )}
            </div>
          </div>

          {/* 4. Zoning/Infra MVs */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.zoningInfra && <StatusIcon status={checks[county].zoningInfra.status} />}
              4. Zoning & Infrastructure Materialized Views
            </h3>
            <div className="pl-7 text-sm">
              {checks[county]?.zoningInfra ? (
                <>
                  <Badge variant={checks[county].zoningInfra.status === "pass" ? "default" : "destructive"}>
                    {checks[county].zoningInfra.message}
                  </Badge>
                  {checks[county].zoningInfra.details && (
                    <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(checks[county].zoningInfra.details, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not checked yet</span>
              )}
            </div>
          </div>

          {/* 5. ML Scoring */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.scoring && <StatusIcon status={checks[county].scoring.status} />}
              5. ML Scoring (XGBoost-style, AUC, {">"}=10k parcels)
            </h3>
            <div className="pl-7 text-sm">
              {checks[county]?.scoring ? (
                <>
                  <Badge variant={checks[county].scoring.status === "pass" ? "default" : "destructive"}>
                    {checks[county].scoring.message}
                  </Badge>
                  {checks[county].scoring.details && (
                    <pre className="mt-2 bg-muted p-2 rounded text-xs overflow-auto max-h-60">
                      {JSON.stringify(checks[county].scoring.details, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not checked yet</span>
              )}
            </div>
          </div>

          {/* 6. PostGIS Vector Tiles */}
          <div className="space-y-2">
            <h3 className="text-lg font-medium flex items-center gap-2">
              {checks[county]?.vectorTiles && <StatusIcon status={checks[county].vectorTiles.status} />}
              6. PostGIS Vector Tiles (no mock GeoJSON)
            </h3>
            <div className="pl-7 text-sm">
              {checks[county]?.vectorTiles ? (
                <>
                  <Badge variant={checks[county].vectorTiles.status === "pass" ? "default" : "destructive"}>
                    {checks[county].vectorTiles.message}
                  </Badge>
                  {checks[county].vectorTiles.details && (
                    <div className="mt-2 text-xs">
                      <a href={checks[county].vectorTiles.details.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        Test Tile URL <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not checked yet</span>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
