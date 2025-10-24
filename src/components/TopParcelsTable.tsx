import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, MapPin } from "lucide-react";

interface TopParcelsTableProps {
  onParcelSelect: (parcelId: string) => void;
}

// Mock data - will be replaced with real API data
const mockParcels = [
  {
    id: "wake-12345",
    pin: "1234567890",
    county: "Wake",
    address: "1234 Development Blvd, Raleigh",
    score: 87.4,
    probability: 76,
    landValue: 215000,
    acreage: 2.47,
    yoyChange: 14.2,
  },
  {
    id: "wake-12346",
    pin: "1234567891",
    county: "Wake",
    address: "5678 Growth Ave, Cary",
    score: 84.2,
    probability: 72,
    landValue: 189000,
    acreage: 1.83,
    yoyChange: 11.8,
  },
  {
    id: "meck-45678",
    pin: "4567890123",
    county: "Mecklenburg",
    address: "910 Expansion Rd, Charlotte",
    score: 82.1,
    probability: 68,
    landValue: 342000,
    acreage: 3.21,
    yoyChange: 9.5,
  },
  {
    id: "durham-78901",
    pin: "7890123456",
    county: "Durham",
    address: "246 Progress St, Durham",
    score: 79.8,
    probability: 65,
    landValue: 156000,
    acreage: 1.54,
    yoyChange: 13.1,
  },
];

const TopParcelsTable = ({ onParcelSelect }: TopParcelsTableProps) => {
  return (
    <Card className="panel-glass p-6 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          Top Investment Parcels
        </h3>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          Live Data
        </Badge>
      </div>

      <div className="space-y-3">
        {mockParcels.map((parcel) => (
          <button
            key={parcel.id}
            onClick={() => onParcelSelect(parcel.id)}
            className="w-full text-left p-4 rounded-lg border bg-card/50 hover:bg-card hover:border-accent/50 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{parcel.address}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  PIN: {parcel.pin} • {parcel.county} County
                </div>
              </div>
              <div className="text-right ml-4">
                <div className="text-2xl font-bold text-success">{parcel.score}</div>
                <div className="text-xs text-muted-foreground">Score</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Rezoning</div>
                <div className="text-sm font-semibold">{parcel.probability}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Land Value</div>
                <div className="text-sm font-semibold">
                  ${(parcel.landValue / 1000).toFixed(0)}k
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Acreage</div>
                <div className="text-sm font-semibold">{parcel.acreage} ac</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">YoY</div>
                <div className="text-sm font-semibold text-success">
                  +{parcel.yoyChange}%
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default TopParcelsTable;
