import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin, Loader2 } from "lucide-react";
import { useTopParcels } from "@/hooks/useTopParcels";

interface TopParcelsTableProps {
  onParcelSelect: (parcelId: string) => void;
}

const TopParcelsTable = ({ onParcelSelect }: TopParcelsTableProps) => {
  const { data, isLoading, error } = useTopParcels();

  if (isLoading) {
    return (
      <Card className="panel-glass p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="panel-glass p-6">
        <div className="text-center text-destructive">
          Failed to load parcels. Please try again.
        </div>
      </Card>
    );
  }

  const parcels = data?.parcels || [];

  return (
    <Card className="panel-glass p-6 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          Top Investment Parcels
        </h3>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          {parcels.length} Parcels
        </Badge>
      </div>

      {parcels.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No parcel data available. Please ingest county data first.
        </div>
      ) : (
        <div className="space-y-3">
          {parcels.map((parcel) => (
            <button
              key={parcel.id}
              onClick={() => onParcelSelect(parcel.id)}
              className="w-full text-left p-4 rounded-lg border bg-card/50 hover:bg-card hover:border-accent/50 transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {parcel.address}, {parcel.city}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PIN: {parcel.pin} • {parcel.county} County
                  </div>
                </div>
                  <div className="text-2xl font-bold text-success">
                    {(parcel.investmentScore * 100).toFixed(1) || "N/A"}
                  </div>
                  <div className="text-xs text-muted-foreground">Score %</div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Rezoning</div>
                  <div className="text-sm font-semibold">
                    {(parcel.rezoningProbability * 100).toFixed(0) || "N/A"}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Land Value</div>
                  <div className="text-sm font-semibold">
                    ${((parcel.landValue || 0) / 1000).toFixed(0)}k
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Acreage</div>
                  <div className="text-sm font-semibold">
                    {parcel.acreage?.toFixed(2) || "N/A"} ac
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">YoY</div>
                  <div className="text-sm font-semibold text-success">
                    +{parcel.yoyChange?.toFixed(1) || "N/A"}%
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};

export default TopParcelsTable;
