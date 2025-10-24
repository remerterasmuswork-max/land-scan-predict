import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Map, TrendingUp, Database, Zap, Shield, BarChart3 } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iaHNsKHZhcigtLWJvcmRlcikpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20" />
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="p-3 rounded-xl bg-primary/10 backdrop-blur-sm">
                <Map className="h-10 w-10 text-primary" />
              </div>
              <TrendingUp className="h-8 w-8 text-accent" />
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              LandVision AI
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8">
              Predictive Upzoning & Parcel Investment Intelligence
            </p>
            
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Identify undervalued parcels with high rezoning potential across Charlotte
              and Research Triangle markets using AI-powered geospatial analytics
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="text-lg px-8"
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="text-lg px-8"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="data-card">
            <Database className="h-8 w-8 text-accent mb-4" />
            <h3 className="text-lg font-bold mb-2">Multi-County Data</h3>
            <p className="text-sm text-muted-foreground">
              Integrated assessor, zoning, and infrastructure data from Wake, Mecklenburg,
              Durham, Orange, and Chatham counties
            </p>
          </div>

          <div className="data-card">
            <Zap className="h-8 w-8 text-accent mb-4" />
            <h3 className="text-lg font-bold mb-2">ML-Powered Scoring</h3>
            <p className="text-sm text-muted-foreground">
              XGBoost models analyze land value trends, zoning patterns, and development
              indicators to predict rezoning probability
            </p>
          </div>

          <div className="data-card">
            <BarChart3 className="h-8 w-8 text-accent mb-4" />
            <h3 className="text-lg font-bold mb-2">Real-Time Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Interactive maps with investibility scoring, historical value tracking,
              and automated parcel monitoring
            </p>
          </div>
        </div>
      </div>

      {/* Market Coverage */}
      <div className="container mx-auto px-4 py-20 border-t">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Market Coverage</h2>
          <p className="text-muted-foreground mb-8">
            Comprehensive parcel analysis across key growth markets
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {["Wake", "Mecklenburg", "Durham", "Orange", "Chatham"].map((county) => (
              <div key={county} className="p-4 rounded-lg border bg-card/50">
                <Shield className="h-6 w-6 text-accent mx-auto mb-2" />
                <div className="font-semibold">{county}</div>
                <div className="text-xs text-muted-foreground">County</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
