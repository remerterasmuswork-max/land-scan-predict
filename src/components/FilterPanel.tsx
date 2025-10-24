import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";

const FilterPanel = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [county, setCounty] = useState("all");
  const [minAcreage, setMinAcreage] = useState([0]);
  const [maxAcreage, setMaxAcreage] = useState([100]);
  const [minProbability, setMinProbability] = useState([0]);

  return (
    <div
      className={`relative bg-card border-r transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-80"
      } z-10`}
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 h-6 w-6 rounded-full bg-card border shadow-sm flex items-center justify-center hover:bg-accent/10 transition-colors z-20"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {isCollapsed ? (
        <div className="flex flex-col items-center pt-6 gap-4">
          <Filter className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : (
        <div className="p-6 space-y-6 overflow-y-auto h-full">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
              <Filter className="h-5 w-5" />
              Filters
            </h2>
          </div>

          <div className="space-y-6">
            {/* County Filter */}
            <div className="space-y-2">
              <Label>County</Label>
              <Select value={county} onValueChange={setCounty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Counties</SelectItem>
                  <SelectItem value="wake">Wake County</SelectItem>
                  <SelectItem value="mecklenburg">Mecklenburg County</SelectItem>
                  <SelectItem value="durham">Durham County</SelectItem>
                  <SelectItem value="orange">Orange County</SelectItem>
                  <SelectItem value="chatham">Chatham County</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Acreage Range */}
            <div className="space-y-2">
              <Label>Min Acreage: {minAcreage[0]}</Label>
              <Slider
                value={minAcreage}
                onValueChange={setMinAcreage}
                max={50}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label>Max Acreage: {maxAcreage[0]}</Label>
              <Slider
                value={maxAcreage}
                onValueChange={setMaxAcreage}
                min={10}
                max={500}
                step={10}
                className="w-full"
              />
            </div>

            {/* Rezoning Probability */}
            <div className="space-y-2">
              <Label>Min Rezoning Probability: {minProbability[0]}%</Label>
              <Slider
                value={minProbability}
                onValueChange={setMinProbability}
                max={100}
                step={5}
                className="w-full"
              />
            </div>

            {/* Zoning Type */}
            <div className="space-y-2">
              <Label>Zoning Type</Label>
              <Select defaultValue="all">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="mixed">Mixed Use</SelectItem>
                  <SelectItem value="agricultural">Agricultural</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply Filters */}
            <Button className="w-full" variant="default">
              Apply Filters
            </Button>

            <Button className="w-full" variant="outline">
              Reset Filters
            </Button>
          </div>

          {/* Stats Card */}
          <Card className="p-4 bg-accent/5 border-accent/20">
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parcels Found:</span>
                <span className="font-semibold">12,847</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Score:</span>
                <span className="font-semibold text-success">72.4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated:</span>
                <span className="font-semibold">2h ago</span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
