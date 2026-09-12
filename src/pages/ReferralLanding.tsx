import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const REFERRAL_CODE_KEY = "forfettino_referral_code";

/**
 * Public route: /referral/:code
 * Stores the referral code in localStorage and redirects to login.
 */
export default function ReferralLandingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) {
      localStorage.setItem(REFERRAL_CODE_KEY, code);
      navigate(`/login?ref=${encodeURIComponent(code)}`, { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [code, navigate]);

  // Brief loading state while redirecting
  return (
    <>
      <Helmet>
        <title>Reindirizzamento Referral | Forfettino</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Reindirizzamento...</p>
      </div>
    </>
  );
}

export { REFERRAL_CODE_KEY };
