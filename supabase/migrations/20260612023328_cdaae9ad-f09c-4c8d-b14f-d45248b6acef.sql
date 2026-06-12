ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Admins manage profiles') THEN
    CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.platform_features (
  feature_key text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  required_plan text NOT NULL DEFAULT 'free',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_features TO authenticated;
GRANT ALL ON public.platform_features TO service_role;
ALTER TABLE public.platform_features ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_features' AND policyname='read platform_features') THEN
    CREATE POLICY "read platform_features" ON public.platform_features FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='platform_features' AND policyname='admin manage platform_features') THEN
    CREATE POLICY "admin manage platform_features" ON public.platform_features FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.plans (
  key text PRIMARY KEY,
  name text NOT NULL,
  price_monthly numeric(12,2) NOT NULL DEFAULT 0,
  price_yearly numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'THB',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlight boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plans' AND policyname='public read plans') THEN
    CREATE POLICY "public read plans" ON public.plans FOR SELECT TO anon, authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='plans' AND policyname='admin manage plans') THEN
    CREATE POLICY "admin manage plans" ON public.plans FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

INSERT INTO public.plans (key,name,price_monthly,price_yearly,features,highlight,sort_order) VALUES
  ('free','Free',0,0,'["1,000 messages/mo","1 channel"]'::jsonb,false,1),
  ('starter','Starter',1490,14900,'["20,000 messages/mo","3 channels","Email support"]'::jsonb,false,2),
  ('growth','Growth',4990,49900,'["Unlimited messages","All channels","Priority support"]'::jsonb,true,3),
  ('enterprise','Enterprise',0,0,'["Custom AI","SLA 99.9%","Dedicated CSM"]'::jsonb,false,4)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.platform_features (feature_key,label,enabled,required_plan) VALUES
  ('sales_search','Search สินค้า',true,'free'),
  ('sales_recommend','Recommend สินค้า',true,'free'),
  ('sales_crosssell','Cross-sell / Upsell',true,'starter'),
  ('sales_bundle','Bundle Suggestion',true,'starter'),
  ('sales_dynamic_pricing','Dynamic Pricing',true,'growth'),
  ('cs_chat_24_7','ตอบแชท 24/7',true,'free'),
  ('cs_order_check','เช็คออเดอร์',true,'free'),
  ('cs_tracking','Tracking พัสดุ',true,'free'),
  ('cs_faq','FAQ Auto Reply',true,'free'),
  ('cs_multilang','Multi-language',true,'starter'),
  ('ops_stock','Check Stock',true,'free'),
  ('ops_process_order','Process Order',true,'starter'),
  ('ops_warranty','Warranty Claim',true,'starter'),
  ('ops_reorder','Auto Reorder',true,'growth'),
  ('ops_fraud','Fraud Detection',true,'growth'),
  ('mkt_segment','Segment ลูกค้า',true,'starter'),
  ('mkt_promo','Personalized Promo',true,'starter'),
  ('mkt_cart_recovery','Cart Recovery',true,'starter'),
  ('mkt_churn','Predict Churn',true,'growth'),
  ('mkt_ads_audience','Ads Audience AI',true,'growth')
ON CONFLICT (feature_key) DO NOTHING;

DROP TRIGGER IF EXISTS plans_touch ON public.plans;
CREATE TRIGGER plans_touch BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS platform_features_touch ON public.platform_features;
CREATE TRIGGER platform_features_touch BEFORE UPDATE ON public.platform_features FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();