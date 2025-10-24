import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Map, TrendingUp } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Map className="h-8 w-8 text-primary" />
            </div>
            <TrendingUp className="h-6 w-6 text-accent" />
          </div>
          <h1 className="text-3xl font-bold mb-2">LandVision AI</h1>
          <p className="text-muted-foreground">
            Predictive upzoning & parcel investment intelligence
          </p>
        </div>

        <div className="panel-glass p-8">
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "hsl(195, 85%, 45%)",
                    brandAccent: "hsl(215, 70%, 25%)",
                  },
                },
              },
            }}
            providers={[]}
            redirectTo={`${window.location.origin}/dashboard`}
          />
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Access geospatial analytics for Charlotte and Research Triangle markets
        </p>
      </div>
    </div>
  );
};

export default Auth;
