import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

const AdminChecklist = () => {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Pre-Implementation Checklist</h1>
        <p className="text-muted-foreground">
          Blocker questions that must be answered before proceeding with implementation
        </p>
      </div>

      {/* 0.1 Data Sources */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-2xl font-bold mb-2">0.1 Data Proof: Feature Service Endpoints</h2>
            <p className="text-muted-foreground mb-4">
              Exact data source URLs for each target county
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg mb-2">Wake County (Research Triangle)</h3>
            <div className="space-y-2">
              <div>
                <Badge variant="outline" className="mb-2">Parcels</Badge>
                <a 
                  href="https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Fields: PIN, REID, CALC_AREA, LAND_VAL, BLDG_VAL, TOTAL_VALUE_ASSD, TYPE_AND_USE, LAND_CLASS, DEED_DATE, SALE_DATE, TOTSALPRICE, OWNER, ADDR1, ADDR2, ADDR3
                </p>
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Zoning</Badge>
                <a 
                  href="https://maps.wakegov.com/arcgis/rest/services/Planning/Zoning/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://maps.wakegov.com/arcgis/rest/services/Planning/Zoning/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Fields: ZONING, ZONEDESC, JURISDICTION, EFFECTIVE_DATE
                </p>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg mb-2">Mecklenburg County (Charlotte)</h3>
            <div className="space-y-2">
              <div>
                <Badge variant="outline" className="mb-2">Parcels</Badge>
                <a 
                  href="https://parcelviewer.geodecisions.com/arcgis/rest/services/Charlotte/Public/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://parcelviewer.geodecisions.com/arcgis/rest/services/Charlotte/Public/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Fields: PARCELPIN, ACREAGE, LANDVALUE, BUILDINGVALUE, TOTALVALUE, SALEDATE, SALEPRICE, OWNERNAME, MAILINGADDR, ZONINGCODE
                </p>
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Zoning</Badge>
                <a 
                  href="https://gis.mecknc.gov/arcgis/rest/services/Public/Zoning/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://gis.mecknc.gov/arcgis/rest/services/Public/Zoning/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg mb-2">Durham County (Research Triangle)</h3>
            <div className="space-y-2">
              <div>
                <Badge variant="outline" className="mb-2">Parcels</Badge>
                <a 
                  href="https://webgis.durhamnc.gov/server/rest/services/PublicServices/Property/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://webgis.durhamnc.gov/server/rest/services/PublicServices/Property/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg mb-2">Orange County (Research Triangle)</h3>
            <div className="space-y-2">
              <div>
                <Badge variant="outline" className="mb-2">Parcels</Badge>
                <a 
                  href="https://gis.orangecountync.gov/arcgis/rest/services/WebMainService/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://gis.orangecountync.gov/arcgis/rest/services/WebMainService/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <Badge variant="outline" className="mb-2">Zoning</Badge>
                <a 
                  href="https://gis.orangecountync.gov/arcgis/rest/services/WebIdentifyServiceZoning/MapServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://gis.orangecountync.gov/arcgis/rest/services/WebIdentifyServiceZoning/MapServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold text-lg mb-2">Chatham County</h3>
            <div className="space-y-2">
              <div>
                <Badge variant="outline" className="mb-2">Parcels via NC OneMap</Badge>
                <a 
                  href="https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground mt-1">
                  Filter: COUNTY = 'CHATHAM'
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg mt-4">
            <h4 className="font-semibold mb-2">NC OneMap Statewide Fallback</h4>
            <a 
              href="https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              https://services.nconemap.gov/secure/rest/services/NC1Map_Parcels/FeatureServer/0
              <ExternalLink className="h-3 w-3" />
            </a>
            <p className="text-xs text-muted-foreground mt-2">
              NC OneMap provides standardized statewide parcel data from all 100 counties. 
              Use this as fallback when county-specific services are unavailable.
            </p>
          </div>
        </div>
      </Card>

      {/* 0.2 History Strategy */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-2xl font-bold mb-2">0.2 History Strategy</h2>
            <p className="text-muted-foreground mb-4">
              Approach for building historical land value and use change data
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-primary/5 border-l-4 border-primary p-4 rounded">
            <h3 className="font-semibold text-lg mb-2">✓ CHOSEN: Own Snapshot + Diff Strategy</h3>
            <p className="text-sm mb-3">
              We will build our own historical database through automated monthly snapshots and delta computation.
            </p>
            
            <div className="space-y-2 text-sm">
              <div>
                <Badge className="mb-1">Implementation</Badge>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Run monthly ingestion jobs via cron/scheduler for each county</li>
                  <li>On each ingest, capture snapshot into <code className="bg-background px-1 rounded">parcel_history</code> with <code className="bg-background px-1 rounded">ts = now()::date</code></li>
                  <li>Store: <code className="bg-background px-1 rounded">land_val</code>, <code className="bg-background px-1 rounded">total_value_assd</code>, <code className="bg-background px-1 rounded">type_and_use</code>, <code className="bg-background px-1 rounded">type_use_decode</code>, <code className="bg-background px-1 rounded">zoning_code</code></li>
                  <li>Compute deltas: YoY %Δ land value, type/use changes, zoning changes</li>
                  <li>Materialized view <code className="bg-background px-1 rounded">parcel_signals_mv</code> joins current + historical + computed signals</li>
                </ul>
              </div>

              <div>
                <Badge variant="outline" className="mb-1">Advantages</Badge>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>No licensing fees or API limits</li>
                  <li>Full control over data quality and update frequency</li>
                  <li>Can backfill by importing historical public records</li>
                  <li>Compute custom signals (e.g., plat changes, permit density)</li>
                </ul>
              </div>

              <div>
                <Badge variant="outline" className="mb-1">Cold Start Solution</Badge>
                <p className="ml-2 mt-1">
                  To enable YoY calculations immediately, we will:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Import last 2-3 years of public tax assessment records where available</li>
                  <li>Mark historical records with <code className="bg-background px-1 rounded">source = 'backfill'</code></li>
                  <li>This provides immediate training data for ML models</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded">
            <h4 className="font-semibold mb-2">❌ NOT CHOSEN: Commercial Data (ATTOM/CoreLogic)</h4>
            <p className="text-xs text-muted-foreground">
              While commercial providers offer rich historical data (20+ years), they require:
              licensing fees ($5k-50k/year), usage restrictions, attribution requirements, 
              and API rate limits. We avoid this to maintain operational flexibility and cost efficiency.
            </p>
          </div>
        </div>
      </Card>

      {/* 0.3 Upzoning Proxies */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-2xl font-bold mb-2">0.3 Upzoning Proxies</h2>
            <p className="text-muted-foreground mb-4">
              Computed signals that indicate upzoning potential
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">YoY %Δ Land Value</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              <code className="bg-background px-1 rounded">(land_val_t - land_val_t-12m) / land_val_t-12m</code>
              <br />Strong predictor of rezoning activity. Values &gt;50% flag high interest.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Type & Use Change</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Boolean flag when <code className="bg-background px-1 rounded">type_and_use</code> changes between snapshots.
              <br />Indicates conversion (e.g., vacant → commercial, residential → mixed-use).
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Plat / Subdivision Activity</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Track PIN splits (single PIN → multiple PINs) and "BM" (benchmark) changes.
              <br />Signals active subdivision development.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Distance to Future Infrastructure</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              PostGIS computation: distance to planned highways, collectors, sewer/water mains.
              <br />Parcels within 500m of future infra have higher upzone probability.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Adjacent Higher Zoning</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Spatial join: count adjacent parcels with higher-density zoning.
              <br />Strong indicator of "next in line" for upzoning.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Building Permit Density</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Count permits within 1km radius over last 36 months.
              <br />High permit activity = development pressure = upzoning potential.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Land Value / Acre Ratio</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Compare parcel's <code className="bg-background px-1 rounded">land_val / acre</code> to neighborhood median.
              <br />Undervalued parcels (bottom quartile) are upzone targets.
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h3 className="font-semibold">Urban Service Area</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Boolean: inside designated urban service boundary.
              <br />Municipalities prioritize upzoning within service areas.
            </p>
          </div>
        </div>

        <div className="mt-4 bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Composite Signal: Investment Score</h4>
          <p className="text-sm">
            <code className="bg-background px-1 rounded">investment_score = 0.6 × rezoning_probability + 0.4 × undervaluation_percentile</code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Final 0-1 score combining ML-predicted rezoning probability with relative undervaluation.
            Top 100 parcels per county ranked by this score.
          </p>
        </div>
      </Card>

      {/* 0.4 Licensing & Compliance */}
      <Card className="p-6 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-2xl font-bold mb-2">0.4 Licensing & Compliance</h2>
            <p className="text-muted-foreground mb-4">
              Data storage, usage, and attribution policy
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-l-4 border-success pl-4">
            <h3 className="font-semibold mb-2">✓ Public GIS Data (County/Municipal Sources)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Parcel boundaries, assessor data, zoning layers are <strong>public records</strong></li>
              <li>We may cache and store full datasets in our database</li>
              <li>No licensing fees or attribution required (but we credit sources in UI)</li>
              <li>Comply with terms of service (e.g., no resale of raw data as a product)</li>
            </ul>
          </div>

          <div className="border-l-4 border-primary pl-4">
            <h3 className="font-semibold mb-2">✓ Derived Signals (Our IP)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Computed signals (YoY %Δ, rezoning probability, investment scores) are <strong>our proprietary work</strong></li>
              <li>These are not redistributable public records—they're analysis outputs</li>
              <li>No attribution required; we own the ML models and scoring logic</li>
            </ul>
          </div>

          <div className="border-l-4 border-warning pl-4">
            <h3 className="font-semibold mb-2">⚠ Third-Party Commercial Data (If Used)</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>If we later integrate ATTOM, CoreLogic, or similar: store only derived signals, not raw records</li>
              <li>Comply with license terms (e.g., no bulk download, attribution in UI)</li>
              <li>Keep raw third-party data ephemeral (cache for processing, then discard)</li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Storage Policy Summary</h4>
            <div className="text-sm space-y-1">
              <p>✓ <strong>Store permanently:</strong> Public GIS data (parcels, zoning, infra), our computed signals</p>
              <p>✓ <strong>Attribution:</strong> Credit county sources in footer/about page (optional but good practice)</p>
              <p>✗ <strong>Do not:</strong> Resell raw public data, violate service ToS, store unlicensed commercial data</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-6 bg-success/5 border-success">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 text-success mt-1" />
          <div>
            <h2 className="text-2xl font-bold mb-2">Blockers Resolved ✓</h2>
            <p className="text-muted-foreground mb-4">
              All pre-implementation questions answered. Ready to proceed with:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Schema migrations (parcels, parcel_history, parcel_scores extensions)</li>
              <li>Real data ingestion (5 counties, Esri REST → PostGIS)</li>
              <li>Historical snapshot system (monthly diffs, YoY signals)</li>
              <li>Zoning + infrastructure spatial joins</li>
              <li>XGBoost scoring model (rezoning_probability, investment_score)</li>
              <li>Vector tiles + working map interface</li>
            </ol>
            <div className="mt-4 p-3 bg-background rounded border">
              <p className="text-xs font-mono">
                <strong>Next command:</strong> Approve schema migrations and begin ingestion implementation
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdminChecklist;
