import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, TrendingUp, MapPin, Calendar, DollarSign, Ruler, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ParcelDetailSidebarProps {
  parcelId: string;
  onClose: () => void;
}

// Mock data - will be replaced with real API data
const mockHistoricalData = [
  { year: "2019", value: 125000 },
  { year: "2020", value: 132000 },
  { year: "2021", value: 148000 },
  { year: "2022", value: 165000 },
  { year: "2023", value: 189000 },
  { year: "2024", value: 215000 },
];

const ParcelDetailSidebar = ({ parcelId, onClose }: ParcelDetailSidebarProps) => {
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
          <div className="text-3xl font-bold text-success">87.4</div>
          <p className="text-xs text-muted-foreground mt-1">
            Top 5% in Wake County
          </p>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Land Value</span>
            </div>
            <div className="text-lg font-semibold">$215,000</div>
            <Badge variant="outline" className="text-xs mt-1 bg-success/10 text-success border-success/20">
              +14.2% YoY
            </Badge>
          </Card>

          <Card className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Ruler className="h-4 w-4 text-accent" />
              <span className="text-xs text-muted-foreground">Acreage</span>
            </div>
            <div className="text-lg font-semibold">2.47 ac</div>
            <span className="text-xs text-muted-foreground">107,593 sq ft</span>
          </Card>
        </div>

        {/* Rezoning Probability */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Rezoning Probability</span>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
              High
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next 2 Years</span>
              <span className="font-semibold">76%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-warning" style={{ width: "76%" }} />
            </div>
          </div>
        </Card>

        {/* Land Value History */}
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-4">Land Value History</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={mockHistoricalData}>
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
                  1234 Development Blvd, Raleigh, NC 27601
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Current Zoning</div>
                <div className="text-xs text-muted-foreground">
                  R-4 Residential (Low Density)
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Last Sale Date</div>
                <div className="text-xs text-muted-foreground">March 15, 2022</div>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium">Owner Type</div>
                <div className="text-xs text-muted-foreground">Individual</div>
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
            This parcel shows strong indicators for upzoning within the next 24 months based on:
            nearby infrastructure development, consistent land value appreciation (14.2% YoY),
            and proximity to recently rezoned parcels. Current R-4 zoning is likely to transition
            to higher-density mixed-use designation.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default ParcelDetailSidebar;
