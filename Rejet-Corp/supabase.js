// supabase.js

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://wjgdtdseobwedjjedhvn.supabase.co";
const supabaseAnonKey = "sb_publishable_KQ5sTkILlR2A1gY7Ni2jqA_4q4hBXV7";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);