import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, MapPin, Calendar, DollarSign, Ruler, FileText, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useParcelDetail } from "@/hooks/useParcelDetail";

interface ParcelDetailSidebarProps {
  parcelId: string;
  onClose: () => void;
}

const ParcelDetailSidebar = ({ parcelId, onClose }: ParcelDetailSidebarProps) => {
  const { data: parcel, isLoading, error } = useParcelDetail(parcelId);

  if (isLoading) {
    return (
      <div className="w-96 bg-card border-l h-full overflow-y-auto z-10">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (error || !parcel) {
    return (
      <div className="w-96 bg-card border-l h-full overflow-y-auto z-10">
        <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Error</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4 text-center text-destructive">
          Failed to load parcel details
        </div>
      </div>
    );
  }

  const score = parcel.parcel_scores?.[0];
  const history = parcel.parcel_history || [];
  const historicalData = history.map((h: any) => ({
    year: h.year.toString(),
    value: h.land_value,
  })).sort((a: any, b: any) => parseInt(a.year) - parseInt(b.year));

  return (
    <div className="w-96 bg-card border-l h-full overflow-y-auto z-10">
      <div className="sticky top-0 bg-card border-b p-4 flex items-center justify-between z-20">
        <div>
          <h2 className="text-lg font-bold">Parcel Details</h2>
          <p className="text-xs text-muted-foreground">PIN: {parcelId}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="p-4 space-y-6">
        {/* Investment Score */}
        <Card className="p-4 bg-gradient-to-br from-success/10 to-success/5 border-success/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Investment Score</span>
            <TrendingUp className="h-4 w-4 text-success" />
          </div>
          <div className="text-3xl font-bold text-success">
            {score?.investment_score?.toFixed(1) || "N/A"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {parcel.county} County
          </p>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Land Value</span>
            </div>
            <div className="text-lg font-semibold">
              ${parcel.land_value?.toLocaleString() || "N/A"}
            </div>
            {score?.land_value_yoy_change && (
              <Badge variant="outline" className="text-xs mt-1 bg-success/10 text-success border-success/20">
                +{score.land_value_yoy_change.toFixed(1)}% YoY
              </Badge>
            )}
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Ruler className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Acreage</span>
            </div>
            <div className="text-lg font-semibold">
              {parcel.acreage?.toFixed(2) || "N/A"} ac
            </div>
            <span className="text-xs text-muted-foreground">
              {parcel.acreage ? (parcel.acreage * 43560).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "N/A"} sq ft
            </span>
          </Card>
        </div>

        {/* Rezoning Probability */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Rezoning Probability</span>
            <Badge variant="outline" className={
              !score?.rezoning_probability ? "bg-muted/10 text-muted-foreground border-muted" :
              score.rezoning_probability >= 70 ? "bg-warning/10 text-warning border-warning/20" :
              score.rezoning_probability >= 50 ? "bg-info/10 text-info border-info/20" :
              "bg-muted/10 text-muted-foreground border-muted"
            }>
              {!score?.rezoning_probability ? "N/A" :
               score.rezoning_probability >= 70 ? "High" :
               score.rezoning_probability >= 50 ? "Medium" : "Low"}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next 2 Years</span>
              <span className="font-semibold">
                {score?.rezoning_probability?.toFixed(0) || "N/A"}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-warning" 
                style={{ width: `${score?.rezoning_probability || 0}%` }} 
              />
            </div>
          </div>
        </Card>

        {/* Land Value History */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-4">Land Value History</h3>
          {historicalData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="year" 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Value"]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--accent))" 
                strokeWidth={2}
                dot={{ fill: "hsl(var(--accent))" }}
              />
            </LineChart>
          </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No historical data available
            </div>
          )}
        </Card>

        {/* Property Details */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Property Details</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Location</div>
                <div className="text-xs text-muted-foreground">
                  {parcel.address}, {parcel.city}, {parcel.zip_code || "NC"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Current Zoning</div>
                <div className="text-xs text-muted-foreground">
                  {parcel.zoning_code || "N/A"} - {parcel.type_and_use || "Unknown"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Last Sale Date</div>
                <div className="text-xs text-muted-foreground">
                  {parcel.deed_date ? new Date(parcel.deed_date).toLocaleDateString() : "N/A"}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Owner Type</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {parcel.owner_type || "Unknown"}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* AI Insights */}
        <Card className="p-4 bg-accent/5 border-accent/20">
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            AI Investment Insights
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {parcel.ai_insights || "Analyzing parcel data for investment insights..."}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default ParcelDetailSidebar;
