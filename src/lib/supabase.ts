import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function callEdgeFunction<T = any>(functionName: string, params?: string): Promise<T> {
  const url = params
    ? `${supabaseUrl}/functions/v1/${functionName}?${params}`
    : `${supabaseUrl}/functions/v1/${functionName}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Edge function ${functionName} returned ${response.status}`);
  }

  const data = await response.json();
  return data.success ? data.data : data;
}

export async function runFullAnalysis(): Promise<any> {
  return callEdgeFunction("orchestrator");
}
