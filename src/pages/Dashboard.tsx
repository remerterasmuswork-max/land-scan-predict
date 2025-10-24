import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import MapView from "@/components/MapView";
import FilterPanel from "@/components/FilterPanel";
import ParcelDetailSidebar from "@/components/ParcelDetailSidebar";
import TopParcelsTable from "@/components/TopParcelsTable";
import { Button } from "@/components/ui/button";
import { LogOut, Map, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-16 border-b bg-card/50 backdrop-blur-sm flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Map className="h-6 w-6 text-primary" />
            <TrendingUp className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold">LandVision AI</h1>
            <p className="text-xs text-muted-foreground">Charlotte & Research Triangle</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user.email}</span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Filter Panel */}
        <FilterPanel />

        {/* Map View */}
        <div className="flex-1 relative">
          <MapView onParcelSelect={setSelectedParcelId} />
          
          {/* Floating Table Toggle */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <Button
              onClick={() => setShowTable(!showTable)}
              variant="default"
              className="shadow-lg"
            >
              {showTable ? "Hide" : "Show"} Top Parcels
            </Button>
          </div>

          {/* Top Parcels Table */}
          {showTable && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl z-10">
              <TopParcelsTable onParcelSelect={setSelectedParcelId} />
            </div>
          )}
        </div>

        {/* Parcel Detail Sidebar */}
        {selectedParcelId && (
          <ParcelDetailSidebar
            parcelId={selectedParcelId}
            onClose={() => setSelectedParcelId(null)}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
